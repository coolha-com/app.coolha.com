import "server-only"

import { isDatabaseConfigured, query } from "./postgres"

/**
 * Waffo Pancake 法币订单账本。
 *
 * 只做两件事：**建单**（发起收银台前）与**核销**（收到已验签的回调后）。
 * 不碰卡数据、不做退款、不碰税务——那些都是 Merchant of Record 的职责。
 *
 * 幂等约定（重要）：
 *  - claimWaffoEvent 用主键冲突拦截重复投递；
 *  - markWaffoOrderPaid 只从 pending 迁入，重复回调不会二次核销；
 *  - markWaffoOrderRefunded 只从 pending/paid 迁入，
 *    因此「退款之后又收到一条重投的 order.completed」也不会把订单复活。
 */

export type WaffoOrderStatus = "pending" | "paid" | "refunded" | "failed"

export interface WaffoOrder {
  id: string
  subject: string
  productId: string
  currency: string
  amount: string
  status: WaffoOrderStatus
  buyerEmail: string | null
  checkoutUrl: string | null
  waffoOrderId: string | null
  waffoPaymentId: string | null
  paidAt: Date | null
  refundedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface WaffoOrderRow {
  id: string
  subject: string
  product_id: string
  currency: string
  amount: string
  status: string
  buyer_email: string | null
  checkout_url: string | null
  waffo_order_id: string | null
  waffo_payment_id: string | null
  paid_at: Date | null
  refunded_at: Date | null
  created_at: Date
  updated_at: Date
}

function toOrder(row: WaffoOrderRow): WaffoOrder {
  return {
    id: row.id,
    subject: row.subject,
    productId: row.product_id,
    currency: row.currency,
    amount: row.amount,
    status: (row.status as WaffoOrderStatus) ?? "pending",
    buyerEmail: row.buyer_email,
    checkoutUrl: row.checkout_url,
    waffoOrderId: row.waffo_order_id,
    waffoPaymentId: row.waffo_payment_id,
    paidAt: row.paid_at,
    refundedAt: row.refunded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export interface CreateWaffoOrderInput {
  /** 我们生成的单号；同时作为 orderMerchantExternalId 传给 Waffo */
  id: string
  subject: string
  productId: string
  currency: string
  amount: string
  buyerEmail: string | null
  buyerIdentity: string
}

/** 建单（pending）。返回 null 表示 DB 未配置或写入失败。 */
export async function createWaffoOrder(input: CreateWaffoOrderInput): Promise<WaffoOrder | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const { rows } = await query<WaffoOrderRow>(
      `INSERT INTO waffo_orders
         (id, subject, product_id, currency, amount, status, buyer_email, buyer_identity)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [
        input.id,
        input.subject,
        input.productId,
        input.currency,
        input.amount,
        input.buyerEmail,
        input.buyerIdentity,
      ],
    )
    const row = rows[0]
    return row ? toOrder(row) : null
  } catch (error) {
    console.error("[waffo] 建单失败:", error)
    return null
  }
}

/** 回填收银台 URL（便于排查用户卡在哪一步） */
export async function setWaffoCheckoutUrl(id: string, checkoutUrl: string): Promise<void> {
  if (!isDatabaseConfigured()) return
  try {
    await query(
      `UPDATE waffo_orders
          SET checkout_url = $2, updated_at = now()
        WHERE id = $1`,
      [id, checkoutUrl],
    )
  } catch (error) {
    console.error("[waffo] 回填收银台 URL 失败:", error)
  }
}

/**
 * 这个投递 id 处理过没有（前置检查，用于快速跳过重复投递）。
 *
 * 注意：真正的幂等保证在**状态机**上（markWaffoOrderPaid 只认 pending → paid），
 * 这里只是省一次无用功的审计查询。
 */
export async function hasProcessedWaffoEvent(eventId: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false
  try {
    const { rows } = await query<{ event_id: string }>(
      `SELECT event_id FROM waffo_webhook_events WHERE event_id = $1 LIMIT 1`,
      [eventId],
    )
    return rows.length > 0
  } catch (error) {
    console.error("[waffo] 查询 webhook 事件失败:", error)
    return false
  }
}

/**
 * 记录一个已处理完的投递（审计 + 去重）。
 *
 * 必须在**处理成功之后**调用：如果先记后处理，处理失败时 Waffo 的重试会被
 * 这条记录挡掉，订单就永远核销不了——这是 webhook 最常见的丢单姿势。
 * 重复插入用 ON CONFLICT 忽略即可，并发重复投递由状态机兜底。
 */
export async function recordWaffoEvent(
  eventId: string,
  eventType: string,
  orderId: string | null,
): Promise<void> {
  if (!isDatabaseConfigured()) return
  try {
    await query(
      `INSERT INTO waffo_webhook_events (event_id, event_type, order_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id) DO NOTHING`,
      [eventId, eventType, orderId],
    )
  } catch (error) {
    console.error("[waffo] 记录 webhook 事件失败:", error)
  }
}

export interface MarkPaidInput {
  /** 我们的单号（= orderMerchantExternalId） */
  id: string
  waffoOrderId: string
  waffoPaymentId: string | null
  amount: string
  currency: string
  rawEvent: unknown
}

/**
 * 核销为已支付。
 *
 * @returns true = 本次发生了 pending → paid 的迁移（首次核销）；
 *                 false = 之前已核销过（重复回调，不重复发放权益）。
 */
export async function markWaffoOrderPaid(input: MarkPaidInput): Promise<boolean> {
  if (!isDatabaseConfigured()) return false
  const { rowCount } = await query(
    `UPDATE waffo_orders
        SET status            = 'paid',
            waffo_order_id    = $2,
            waffo_payment_id  = $3,
            amount            = $4,
            currency          = $5,
            paid_at           = now(),
            raw_event         = $6::jsonb,
            updated_at        = now()
      WHERE id = $1 AND status = 'pending'`,
    [
      input.id,
      input.waffoOrderId,
      input.waffoPaymentId,
      input.amount,
      input.currency,
      JSON.stringify(input.rawEvent ?? {}),
    ],
  )
  return (rowCount ?? 0) > 0
}

/** 核销为已退款。@returns 是否发生了状态迁移 */
export async function markWaffoOrderRefunded(
  id: string,
  waffoOrderId: string,
  rawEvent: unknown,
): Promise<boolean> {
  if (!isDatabaseConfigured()) return false
  const { rowCount } = await query(
    `UPDATE waffo_orders
        SET status            = 'refunded',
            waffo_order_id    = COALESCE(waffo_order_id, $2),
            refunded_at       = now(),
            raw_event         = $3::jsonb,
            updated_at        = now()
      WHERE id = $1 AND status IN ('pending', 'paid')`,
    [id, waffoOrderId, JSON.stringify(rawEvent ?? {})],
  )
  return (rowCount ?? 0) > 0
}

/**
 * 测试模式专用：直接写一条「已支付」订单（不经过 Waffo 沙箱收银台）。
 *
 * 用途仅限本地联调：让「订单 → 授权 → 会话 → 计量 → 额度用满」这条链路
 * 可以在 dev 分支上完整跑通，而不必真的去沙箱收银台付一次款。
 * 调用方必须自己确认处于测试模式（本函数不校验环境）。
 */
export async function createTestPaidWaffoOrder(input: {
  id: string
  subject: string
  productId: string
  currency: string
  amount: string
  buyerEmail: string | null
  buyerIdentity: string
}): Promise<WaffoOrder | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const { rows } = await query<WaffoOrderRow>(
      `INSERT INTO waffo_orders
         (id, subject, product_id, currency, amount, status, buyer_email,
          buyer_identity, waffo_order_id, waffo_payment_id, paid_at)
       VALUES ($1, $2, $3, $4, $5, 'paid', $6, $7, $8, $9, now())
       ON CONFLICT (id) DO NOTHING
       RETURNING *`,
      [
        input.id,
        input.subject,
        input.productId,
        input.currency,
        input.amount,
        input.buyerEmail,
        input.buyerIdentity,
        `waffo_test_${input.id}`,
        `pay_test_${input.id}`,
      ],
    )
    const row = rows[0]
    return row ? toOrder(row) : null
  } catch (error) {
    console.error("[waffo] 写测试订单失败:", error)
    return null
  }
}

/** 按我们的单号查订单 */
export async function findWaffoOrder(id: string): Promise<WaffoOrder | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const { rows } = await query<WaffoOrderRow>(
      `SELECT * FROM waffo_orders WHERE id = $1 LIMIT 1`,
      [id],
    )
    const row = rows[0]
    return row ? toOrder(row) : null
  } catch (error) {
    console.error("[waffo] 查询订单失败:", error)
    return null
  }
}

/** 某用户的 Waffo 订单（最新在前） */
export async function listWaffoOrders(subject: string, limit = 20): Promise<WaffoOrder[]> {
  if (!isDatabaseConfigured() || !subject) return []
  try {
    const { rows } = await query<WaffoOrderRow>(
      `SELECT * FROM waffo_orders
        WHERE subject = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [subject, limit],
    )
    return rows.map(toOrder)
  } catch (error) {
    console.error("[waffo] 查询订单列表失败:", error)
    return []
  }
}

export interface WaffoPurchaseSummary {
  /** 已支付笔数 = 已购买的 Agent 服务次数 */
  paidCalls: number
  /** 累计已支付金额（显示字符串，按币种分组） */
  paidByCurrency: { currency: string; total: string }[]
}

/** 已购次数与金额汇总：购买页与账单页用它显示「已买 N 次」 */
export async function readWaffoPurchaseSummary(
  subject: string,
): Promise<WaffoPurchaseSummary> {
  const empty: WaffoPurchaseSummary = { paidCalls: 0, paidByCurrency: [] }
  if (!isDatabaseConfigured() || !subject) return empty
  try {
    const { rows } = await query<{ currency: string; total: string; calls: string }>(
      `SELECT currency, SUM(amount::numeric)::text AS total, COUNT(*)::text AS calls
         FROM waffo_orders
        WHERE subject = $1 AND status = 'paid'
        GROUP BY currency`,
      [subject],
    )
    if (rows.length === 0) return empty
    const paidCalls = rows.reduce((sum, row) => sum + Number(row.calls ?? 0), 0)
    return {
      paidCalls,
      paidByCurrency: rows.map((row) => ({
        currency: row.currency,
        total: Number(row.total ?? 0).toFixed(2),
      })),
    }
  } catch (error) {
    console.error("[waffo] 汇总购买记录失败:", error)
    return empty
  }
}
