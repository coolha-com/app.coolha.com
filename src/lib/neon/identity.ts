import "server-only"

import { isDatabaseConfigured, query, transaction } from "./postgres"

/**
 * 内部身份解析：凭证 → users.id。
 *
 * 依据 docs/ARCHITECTURE_IDENTITY_BILLING.md 决策二：凭证（钱包地址、邮箱、社交账号）
 * 只是登录方式，user_id 才是「人」。业务外键（权益、额度、账单）一律挂在 user_id 上。
 * 一个 users.id 下可以绑多条凭证 —— 这是「Google 登录取到 A、MetaMask 连上 B 却算两个人」
 * 这个问题的根治法。表见 db/migrations/006_identity_users.sql / 012_identity_web2.sql。
 *
 * kind 取值：
 *   evm_signing —— address = 小写 EVM 地址（钱包签名登录）
 *   email       —— address = 小写邮箱（Neon Auth 邮箱验证码登录；已验证才写入，用于跨登录方式合并）
 *   neon_auth   —— address = Neon Auth 的 user.id（uuid），会话解析的快速通道
 */

export const IDENTITY_KIND_EVM = "evm_signing"
export const IDENTITY_KIND_EMAIL = "email"
export const IDENTITY_KIND_NEON = "neon_auth"

/** 地址 → user_id；不存在则顺带创建（首次登录时发生）。失败返回 null。 */
export async function resolveUserId(address: string): Promise<string | null> {
  if (!isDatabaseConfigured() || !address) return null
  const normalized = address.toLowerCase()

  const upsert = async () => {
    const { rows } = await query<{ user_id: string }>(
      `WITH existing AS (
         SELECT user_id FROM user_identities
          WHERE kind = $1 AND address = $2
       ),
       new_user AS (
         INSERT INTO users (id)
         SELECT gen_random_uuid() WHERE NOT EXISTS (SELECT 1 FROM existing)
         RETURNING id
       ),
       new_ident AS (
         INSERT INTO user_identities (kind, address, user_id)
         SELECT $1, $2, id FROM new_user
         RETURNING user_id
       )
       SELECT COALESCE(
         (SELECT user_id FROM existing),
         (SELECT user_id FROM new_ident)
       ) AS user_id`,
      [IDENTITY_KIND_EVM, normalized],
    )
    return rows[0]?.user_id ?? null
  }

  try {
    const userId = await upsert()
    if (userId) return userId
  } catch (error) {
    // 并发首次登录会在 new_ident 上撞唯一键；重试一次读取即可
    console.error("[identity] 创建身份失败，回退读取:", error)
  }

  try {
    const { rows } = await query<{ user_id: string }>(
      `SELECT user_id FROM user_identities WHERE kind = $1 AND address = $2`,
      [IDENTITY_KIND_EVM, normalized],
    )
    return rows[0]?.user_id ?? null
  } catch (error) {
    console.error("[identity] 读取身份失败:", error)
    return null
  }
}

/**
 * 业务主键（entitlements / usage_daily / billing_addresses 的 subject）。
 * 正常为 users.id::text；身份层不可用时降级为 `wallet:0x...`，保证产品不被账本拖挂。
 */
export async function resolveSubject(address: string): Promise<string> {
  const userId = await resolveUserId(address)
  return userId ?? `wallet:${address.toLowerCase()}`
}

/** 记住用户用过的付款地址（链上收款匹配后写入，便于后续优先按 from 匹配） */
export async function rememberBillingAddress(
  subject: string,
  address: string,
  label?: string,
): Promise<void> {
  if (!isDatabaseConfigured() || !subject || !address) return
  try {
    await query(
      `INSERT INTO billing_addresses (subject, address, label)
       VALUES ($1, $2, $3)
       ON CONFLICT (subject, address) DO NOTHING`,
      [subject, address.toLowerCase(), label ?? null],
    )
  } catch (error) {
    console.error("[identity] 记录计费地址失败:", error)
  }
}

export interface Web2UserInput {
  /** Neon Auth 的 user.id（uuid） */
  neonUserId: string
  email?: string | null
  /** 只有邮箱经过验证才允许用来合并账号，否则等于把任意人 claim 的邮箱当身份 */
  emailVerified?: boolean
  name?: string | null
  image?: string | null
}

export interface Web2UserProfile {
  userId: string
  /** users 表里的展示名（用户在 /account 改过就是改后的值） */
  name: string | null
  image: string | null
  email: string | null
}

/**
 * Neon Auth 用户 → users.id（不存在则创建），并返回展示资料快照。
 *
 * 合并规则（按顺序）：
 *   ① 已被 neon_auth 身份绑过 → 直接用它（同一会话反复调用的快路径）；
 *   ② 该邮箱已验证，且 email 身份已存在 → 并入那个已有用户（即「先用邮箱登录、后用 Google 登录」是同一个人）；
 *   ③ 都没有 → 建新用户，并把 neon_auth + email 两条身份一起写上。
 *
 * 失败返回 null，调用方决定降级还是报错。
 */
export async function ensureWeb2User(input: Web2UserInput): Promise<Web2UserProfile | null> {
  if (!isDatabaseConfigured() || !input.neonUserId) return null

  const normalizedEmail =
    input.email && input.emailVerified ? input.email.trim().toLowerCase() : null

  try {
    return await transaction(async (client) => {
      let userId: string | undefined

      const bound = await client.query<{ user_id: string }>(
        `SELECT user_id FROM user_identities WHERE kind = $1 AND address = $2`,
        [IDENTITY_KIND_NEON, input.neonUserId],
      )
      userId = bound.rows[0]?.user_id

      // 邮箱合并：把「同一个人用不同登录方式」收拢到同一个 users.id
      if (!userId && normalizedEmail) {
        const byEmail = await client.query<{ user_id: string }>(
          `SELECT user_id FROM user_identities WHERE kind = $1 AND address = $2`,
          [IDENTITY_KIND_EMAIL, normalizedEmail],
        )
        userId = byEmail.rows[0]?.user_id
      }

      if (!userId) {
        const created = await client.query<{ id: string }>(
          `INSERT INTO users (id) VALUES (gen_random_uuid()) RETURNING id`,
        )
        userId = created.rows[0].id

        // 并发首次登录会在 email 上撞唯一键：撞了就沿用对方，丢弃刚建的空壳
        if (normalizedEmail) {
          const inserted = await client.query<{ user_id: string }>(
            `INSERT INTO user_identities (kind, address, user_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (kind, address) DO NOTHING
             RETURNING user_id`,
            [IDENTITY_KIND_EMAIL, normalizedEmail, userId],
          )
          if (inserted.rowCount === 0) {
            const owner = await client.query<{ user_id: string }>(
              `SELECT user_id FROM user_identities WHERE kind = $1 AND address = $2`,
              [IDENTITY_KIND_EMAIL, normalizedEmail],
            )
            const ownerId = owner.rows[0]?.user_id
            if (ownerId) {
              await client.query(`DELETE FROM users WHERE id = $1`, [userId])
              userId = ownerId
            }
          }
        }
      }

      await client.query(
        `INSERT INTO user_identities (kind, address, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (kind, address) DO NOTHING`,
        [IDENTITY_KIND_NEON, input.neonUserId, userId],
      )

      // 展示信息快照：用 COALESCE 保留已有值，避免上游某次不返回 email 就把本地清空。
      // 注意 name/avatar 只在上游有值时补齐——用户在 /account 改过的名字不能被 Neon 的旧值覆盖回去。
      const snapshot = await client.query<{
        primary_email: string | null
        display_name: string | null
        avatar_url: string | null
      }>(
        `UPDATE users
            SET primary_email = COALESCE($2, primary_email),
                display_name  = COALESCE(display_name, $3),
                avatar_url    = COALESCE(avatar_url, $4),
                updated_at    = now()
          WHERE id = $1
          RETURNING primary_email, display_name, avatar_url`,
        [
          userId,
          normalizedEmail ?? input.email?.trim().toLowerCase() ?? null,
          input.name?.trim() || null,
          input.image?.trim() || null,
        ],
      )

      return {
        userId,
        name: snapshot.rows[0]?.display_name ?? null,
        image: snapshot.rows[0]?.avatar_url ?? null,
        email: snapshot.rows[0]?.primary_email ?? null,
      }
    })
  } catch (error) {
    console.error("[identity] 解析 Web2 用户失败:", error)
    return null
  }
}

export interface BindWalletResult {
  /** 该地址最终归属的 users.id */
  userId: string | null
  /** 本次是否新建了用户 */
  created: boolean
  /** 该地址此前已绑定到别的用户 —— 不抢占，按原主人算 */
  conflict: boolean
}

/**
 * 把钱包地址绑到指定用户（已登录 Web2 会话，再连钱包签名的场景）。
 *
 * **不抢占**：地址若已归属他人，保持原主人不变并标记 conflict。
 * 合并两个已有账号的权益是不可逆操作，必须由用户显式确认后单独做，不能在一次登录里悄悄发生。
 */
export async function bindWalletToUser(
  address: string,
  userId: string,
): Promise<BindWalletResult> {
  if (!isDatabaseConfigured() || !address || !userId) {
    return { userId: null, created: false, conflict: false }
  }
  const normalized = address.toLowerCase()

  try {
    const existing = await query<{ user_id: string }>(
      `SELECT user_id FROM user_identities WHERE kind = $1 AND address = $2`,
      [IDENTITY_KIND_EVM, normalized],
    )
    const ownerId = existing.rows[0]?.user_id
    if (ownerId) {
      return { userId: ownerId, created: false, conflict: ownerId !== userId }
    }

    const inserted = await query<{ user_id: string }>(
      `INSERT INTO user_identities (kind, address, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (kind, address) DO NOTHING
       RETURNING user_id`,
      [IDENTITY_KIND_EVM, normalized, userId],
    )
    if (inserted.rows[0]?.user_id) {
      return { userId: inserted.rows[0].user_id, created: true, conflict: false }
    }

    // 并发插入失败：回读真实归属
    const fallback = await query<{ user_id: string }>(
      `SELECT user_id FROM user_identities WHERE kind = $1 AND address = $2`,
      [IDENTITY_KIND_EVM, normalized],
    )
    const fallbackId = fallback.rows[0]?.user_id ?? null
    return {
      userId: fallbackId,
      created: false,
      conflict: Boolean(fallbackId && fallbackId !== userId),
    }
  } catch (error) {
    console.error("[identity] 绑定钱包失败:", error)
    return { userId: null, created: false, conflict: false }
  }
}

export interface UserProfile {
  id: string
  email: string | null
  name: string | null
  image: string | null
  status: string
}

/** 用户展示信息（邮箱/昵称/头像快照，登录时写入） */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!isDatabaseConfigured() || !userId) return null
  try {
    const { rows } = await query<UserProfile>(
      `SELECT id, primary_email AS email, display_name AS name,
              avatar_url AS image, status
         FROM users WHERE id = $1`,
      [userId],
    )
    return rows[0] ?? null
  } catch (error) {
    console.error("[identity] 读取用户信息失败:", error)
    return null
  }
}

/** 某个用户已绑定的所有登录方式（账户页展示「已绑定钱包/邮箱」用） */
export async function listIdentities(
  userId: string,
): Promise<Array<{ kind: string; value: string; createdAt: string }>> {
  if (!isDatabaseConfigured() || !userId) return []
  try {
    const { rows } = await query<{ kind: string; address: string; created_at: Date }>(
      `SELECT kind, address, created_at FROM user_identities
        WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId],
    )
    return rows.map((row) => ({
      kind: row.kind,
      value: row.address,
      createdAt: row.created_at.toISOString(),
    }))
  } catch (error) {
    console.error("[identity] 读取身份列表失败:", error)
    return []
  }
}
