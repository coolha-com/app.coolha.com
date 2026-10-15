import "server-only"

import { isDatabaseConfigured, query } from "./postgres"

/**
 * 内部身份解析：EVM 地址 → users.id。
 *
 * 依据 docs/ARCHITECTURE_IDENTITY_BILLING.md 决策二：地址是身份锚点（凭证），
 * user_id 才是「人」。业务外键（权益、额度、账单）一律挂在 user_id 上。
 * 表见 db/migrations/006_identity_users.sql。
 */

export const IDENTITY_KIND_EVM = "evm_signing"

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
