import "server-only"

import { isDatabaseConfigured, query } from "./postgres"

/**
 * 账户主页（/account）需要的服务端数据。
 *
 * 展示口径：**以业务库 `users` 表为准**，Neon Auth 只当登录凭证。
 * 原因是钱包登录的用户没有 Neon Auth 记录，如果名字只存 Neon，他们永远改不了名；
 * 反过来把 email 也从 Neon 读，是因为邮箱的「验证状态」只有 Neon 知道。
 */

export interface LinkedWallet {
  address: string
  createdAt: string
}

export interface AccountOverview {
  email: string | null
  emailVerified: boolean
  /** 是否设置过密码（Neon Auth 的 credential 账号） */
  hasPassword: boolean
  wallets: LinkedWallet[]
  /** 除钱包外还绑了别的登录方式 —— 决定「最后一个钱包能不能解绑」 */
  hasNonWalletCredential: boolean
  displayName: string | null
  avatarUrl: string | null
}

export async function readAccountOverview(input: {
  neonUserId: string | null
  userId: string | null
}): Promise<AccountOverview> {
  const empty: AccountOverview = {
    email: null,
    emailVerified: false,
    hasPassword: false,
    wallets: [],
    hasNonWalletCredential: false,
    displayName: null,
    avatarUrl: null,
  }
  if (!isDatabaseConfigured()) return empty

  const overview: AccountOverview = { ...empty }

  if (input.userId) {
    try {
      const { rows } = await query<{
        display_name: string | null
        avatar_url: string | null
      }>(`SELECT display_name, avatar_url FROM users WHERE id = $1`, [input.userId])
      overview.displayName = rows[0]?.display_name ?? null
      overview.avatarUrl = rows[0]?.avatar_url ?? null
    } catch (error) {
      console.error("[account] 读取用户资料失败:", error)
    }

    try {
      const { rows } = await query<{ kind: string; address: string; created_at: Date }>(
        `SELECT kind, address, created_at FROM user_identities
          WHERE user_id = $1 ORDER BY created_at ASC`,
        [input.userId],
      )
      overview.wallets = rows
        .filter((row) => row.kind === "evm_signing")
        .map((row) => ({ address: row.address, createdAt: row.created_at.toISOString() }))
      overview.hasNonWalletCredential = rows.some((row) => row.kind !== "evm_signing")
    } catch (error) {
      console.error("[account] 读取身份列表失败:", error)
    }
  }

  // 邮箱与验证状态、密码是否存在，只有 Neon Auth 侧知道
  if (input.neonUserId) {
    try {
      const { rows } = await query<{ email: string | null; emailVerified: boolean }>(
        `SELECT email, "emailVerified" FROM neon_auth."user" WHERE id = $1`,
        [input.neonUserId],
      )
      overview.email = rows[0]?.email ?? null
      overview.emailVerified = Boolean(rows[0]?.emailVerified)
    } catch (error) {
      console.error("[account] 读取 Neon Auth 用户失败:", error)
    }

    try {
      const { rows } = await query<{ has_password: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM neon_auth.account
            WHERE "userId" = $1 AND "providerId" = 'credential' AND password IS NOT NULL
         ) AS has_password`,
        [input.neonUserId],
      )
      overview.hasPassword = Boolean(rows[0]?.has_password)
    } catch (error) {
      console.error("[account] 读取密码状态失败:", error)
    }
  }

  return overview
}

/**
 * 更新展示资料（名称 / 头像）。
 * 两个字段**都按传入值覆盖**：传 null 就是清空，不做 COALESCE —— 否则用户没法删掉头像。
 * 调用方（/api/account/profile）总是把两个字段一起发上来。
 */
export async function updateUserProfile(
  userId: string,
  input: { displayName?: string | null; avatarUrl?: string | null },
): Promise<boolean> {
  if (!isDatabaseConfigured() || !userId) return false
  const clean = (value?: string | null) => {
    const trimmed = value?.trim()
    return trimmed ? trimmed : null
  }
  try {
    await query(
      `UPDATE users
          SET display_name = $2,
              avatar_url   = $3,
              updated_at   = now()
        WHERE id = $1`,
      [userId, clean(input.displayName), clean(input.avatarUrl)],
    )
    return true
  } catch (error) {
    console.error("[account] 更新资料失败:", error)
    return false
  }
}

export type UnbindWalletResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "LAST_CREDENTIAL" | "DB_ERROR"; message: string }

/**
 * 解绑钱包。
 *
 * 拒绝解绑「最后一个凭证」——否则这个账号再也登不进来，
 * 而权益（$19 买的服务）就永久锁死在数据库里，谁也拿不回来。
 */
export async function unbindWallet(
  userId: string,
  address: string,
): Promise<UnbindWalletResult> {
  if (!isDatabaseConfigured() || !userId || !address) {
    return { ok: false, code: "DB_ERROR", message: "数据库未配置" }
  }
  const normalized = address.toLowerCase()

  try {
    const { rows } = await query<{ kind: string; address: string }>(
      `SELECT kind, address FROM user_identities WHERE user_id = $1`,
      [userId],
    )
    const target = rows.find(
      (row) => row.kind === "evm_signing" && row.address === normalized,
    )
    if (!target) {
      return { ok: false, code: "NOT_FOUND", message: "这个钱包没有绑定在当前账号上" }
    }
    if (rows.length <= 1) {
      return {
        ok: false,
        code: "LAST_CREDENTIAL",
        message: "这是账号唯一的登录方式，解绑后将无法再登入。请先绑定邮箱或另一个钱包。",
      }
    }

    await query(`DELETE FROM user_identities WHERE kind = 'evm_signing' AND address = $1`, [
      normalized,
    ])
    return { ok: true }
  } catch (error) {
    console.error("[account] 解绑钱包失败:", error)
    return { ok: false, code: "DB_ERROR", message: "解绑失败，请稍后重试" }
  }
}
