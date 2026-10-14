import { createHash, randomBytes } from "node:crypto"
import { SiweMessage, SiweError } from "siwe"
import { query } from "./postgres"

/**
 * 钱包登录（SIWE, EIP-4361）服务端逻辑。
 * 流程：nonce 签发 → 钱包签名 → 验签 + nonce 状态校验 → 会话令牌（httpOnly Cookie）。
 * Neon Managed Auth 不支持 Web3，故钱包身份自建；表见 db/migrations/001_wallet_auth.sql。
 */

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 会话 7 天
const NONCE_TTL_MS = 5 * 60 * 1000 // nonce 5 分钟有效

export const WALLET_SESSION_COOKIE = "coolha_wallet_session"

export class WalletAuthError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = "WalletAuthError"
  }
}

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/

export function normalizeAddress(address: string): string {
  if (!ADDRESS_PATTERN.test(address)) {
    throw new WalletAuthError("INVALID_ADDRESS", "钱包地址格式不正确")
  }
  return address.toLowerCase()
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export interface NonceResult {
  nonce: string
  domain: string
  expiresAt: Date
}

/** 签发登录 nonce（一次性，5 分钟有效） */
export async function createNonce(address: string, domain: string): Promise<NonceResult> {
  const normalized = normalizeAddress(address)
  // EIP-4361 要求 nonce 为字母数字（base64url 含 - _ 会被拒），用 hex
  const nonce = randomBytes(16).toString("hex")
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS)

  await query(
    `INSERT INTO wallet_nonces (nonce, address, domain, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [nonce, normalized, domain, expiresAt],
  )

  return { nonce, domain, expiresAt }
}

export interface SessionResult {
  address: string
  token: string
  chainId: number
  expiresAt: Date
}

/** 验签并创建会话；成功返回会话令牌（由路由写入 httpOnly Cookie） */
export async function verifySiweAndCreateSession(
  message: string,
  signature: string,
): Promise<SessionResult> {
  let siwe: SiweMessage
  try {
    siwe = new SiweMessage(message)
  } catch {
    throw new WalletAuthError("INVALID_MESSAGE", "SIWE 消息格式不正确")
  }

  // 1. 密码学验签 + domain/nonce 绑定（siwe 内部恢复签名者地址并比对）
  try {
    await siwe.verify({ signature, domain: siwe.domain, nonce: siwe.nonce })
  } catch (error) {
    // 验签失败（含畸形签名）一律视为无效签名，不泄露内部错误细节
    const reason = error instanceof SiweError ? error.type : "malformed signature"
    throw new WalletAuthError("INVALID_SIGNATURE", `签名验证失败：${reason}`)
  }

  const address = normalizeAddress(siwe.address)

  // 2. nonce 必须由本服务端签发、未消费、未过期、地址与域名一致
  const { rows } = await query<{
    address: string
    domain: string
    expires_at: Date
    consumed_at: Date | null
  }>(
    `SELECT address, domain, expires_at, consumed_at FROM wallet_nonces WHERE nonce = $1`,
    [siwe.nonce],
  )
  const record = rows[0]
  if (!record) {
    throw new WalletAuthError("NONCE_NOT_FOUND", "登录请求无效，请重新发起")
  }
  if (record.consumed_at) {
    throw new WalletAuthError("NONCE_CONSUMED", "该登录请求已使用，请重新发起")
  }
  if (record.expires_at.getTime() < Date.now()) {
    throw new WalletAuthError("NONCE_EXPIRED", "登录请求已过期，请重新发起")
  }
  if (record.address !== address) {
    throw new WalletAuthError("ADDRESS_MISMATCH", "钱包地址与登录请求不一致")
  }
  if (record.domain !== siwe.domain) {
    throw new WalletAuthError("DOMAIN_MISMATCH", "登录域名与签发时不一致")
  }

  // 3. 落库用户 + 消费 nonce
  await query(
    `INSERT INTO wallet_users (address, last_login_at)
     VALUES ($1, now())
     ON CONFLICT (address) DO UPDATE SET last_login_at = now()`,
    [address],
  )
  await query(`UPDATE wallet_nonces SET consumed_at = now() WHERE nonce = $1`, [siwe.nonce])

  // 4. 创建会话（不透明令牌，入库仅存哈希；chainId 供统一鉴权流程校验会话有效性）
  const token = randomBytes(32).toString("base64url")
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await query(
    `INSERT INTO wallet_sessions (token_hash, address, chain_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [hashToken(token), address, siwe.chainId, expiresAt],
  )

  return { address, token, chainId: siwe.chainId, expiresAt }
}

export interface WalletSessionInfo {
  address: string
  chainId: number
  expiresAt: Date
}

/** 凭令牌读取会话；无效/过期/已撤销返回 null */
export async function getSessionByToken(token: string): Promise<WalletSessionInfo | null> {
  if (!token) return null
  const { rows } = await query<{
    address: string
    chain_id: number | null
    expires_at: Date
    revoked_at: Date | null
  }>(
    `SELECT s.address, s.chain_id, s.expires_at, s.revoked_at
     FROM wallet_sessions s
     WHERE s.token_hash = $1`,
    [hashToken(token)],
  )
  const session = rows[0]
  if (!session) return null
  if (session.revoked_at) return null
  if (session.expires_at.getTime() < Date.now()) return null
  return {
    address: session.address,
    chainId: session.chain_id ?? 1,
    expiresAt: session.expires_at,
  }
}

/** 撤销会话 */
export async function revokeSession(token: string): Promise<void> {
  if (!token) return
  await query(
    `UPDATE wallet_sessions SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(token)],
  )
}

export const walletAuthCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: Math.floor(SESSION_TTL_MS / 1000),
}
