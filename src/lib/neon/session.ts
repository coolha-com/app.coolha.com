import "server-only"

import { getAuth } from "./auth"
import { ensureWeb2User, getUserProfile, resolveUserId, type UserProfile } from "./identity"
import { getWalletSessionFromCookies } from "./wallet-auth"

/**
 * 统一会话解析：把「Web2 登录（Neon Auth）」与「钱包签名登录（SIWE）」收敛成同一个用户。
 *
 * 产品定位（2026-11-12 定稿）：**Web2 是主登录方式**，钱包是第二登录方式（后续再补 UI）。
 * 两者都只是凭证，业务主键永远是 users.id::text —— 这样「Google 登录取到 A、MetaMask 连上 B
 * 却算两个人、$19 权益不通用」的问题从根上消失。
 *
 * 同时存在两个会话时**以 Web2 为准**：钱包会话（SIWE）可能是同一台机器上别人的钱包，
 * 不能因为浏览器里有它就把当前账号身份改掉。钱包与账号的绑定只在签名那一刻显式发生
 * （见 /api/wallet-auth/verify → bindWalletToUser）。
 */

export type SessionSource = "web2" | "wallet"

export interface CurrentUser {
  /** 业务主键（entitlements / usage_daily / chat_threads / 订单的 subject）：users.id::text */
  subject: string
  /** users.id；身份层不可用时为 null，此时 subject 退化为 `neon:<id>` 或 `wallet:0x…` */
  userId: string | null
  /** Neon Auth 侧的 user.id（只有 Web2 登录才有），查密码/邮箱验证状态要用它 */
  neonUserId: string | null
  source: SessionSource
  /** 钱包地址（仅钱包登录时有；Web2 用户绑了钱包也不在这里返回） */
  address: string | null
  chainId: number | null
  email: string | null
  name: string | null
  image: string | null
  expiresAt: Date
}

const FALLBACK_TTL_MS = 60 * 60 * 1000

async function readWeb2User(): Promise<CurrentUser | null> {
  const auth = getAuth()
  if (!auth) return null

  try {
    const { data } = await auth.getSession()
    const neonUser = data?.user
    if (!neonUser?.id) return null

    const profile = await ensureWeb2User({
      neonUserId: neonUser.id,
      email: neonUser.email ?? null,
      emailVerified: Boolean(neonUser.emailVerified),
      name: neonUser.name ?? null,
      image: neonUser.image ?? null,
    })

    const expiresAt = data?.session?.expiresAt
      ? new Date(data.session.expiresAt)
      : new Date(Date.now() + FALLBACK_TTL_MS)

    return {
      subject: profile?.userId ?? `neon:${neonUser.id}`,
      userId: profile?.userId ?? null,
      neonUserId: neonUser.id,
      source: "web2",
      address: null,
      chainId: null,
      // 展示名以业务库为准（用户在 /account 改过就以改后的值为准），没设过才回落到 Neon 的
      email: profile?.email ?? neonUser.email ?? null,
      name: profile?.name ?? neonUser.name ?? null,
      image: profile?.image ?? neonUser.image ?? null,
      expiresAt,
    }
  } catch (error) {
    // Neon Auth 服务不可达时不能让整页 500：当成未登录，页面给登录入口
    console.error("[session] 读取 Web2 会话失败:", error)
    return null
  }
}

async function readWalletUser(): Promise<CurrentUser | null> {
  const session = await getWalletSessionFromCookies()
  if (!session) return null

  const userId = await resolveUserId(session.address).catch(() => null)
  // 纯钱包账号也可能在 /account 设过显示名与头像，所以同样从业务库读
  const profile = userId ? await getUserProfile(userId).catch(() => null) : null

  return {
    subject: userId ?? `wallet:${session.address.toLowerCase()}`,
    userId,
    neonUserId: null,
    source: "wallet",
    address: session.address,
    chainId: session.chainId,
    email: profile?.email ?? null,
    name: profile?.name ?? null,
    image: profile?.image ?? null,
    expiresAt: session.expiresAt,
  }
}

/** 当前登录用户；未登录返回 null（不抛错，调用方决定 401 还是降级渲染） */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const web2 = await readWeb2User()
  if (web2) return web2
  return readWalletUser()
}

/** 只要能落库的 subject 就用它，未登录返回 null */
export async function getCurrentSubject(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.subject ?? null
}

/** 当前用户的展示信息（邮箱/昵称/头像），用于侧边栏与账单页 */
export async function getCurrentProfile(): Promise<{
  user: CurrentUser
  profile: UserProfile | null
} | null> {
  const user = await getCurrentUser()
  if (!user) return null
  if (!user.userId) return { user, profile: null }

  return { user, profile: await getUserProfile(user.userId) }
}
