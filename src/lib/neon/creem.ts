import "server-only"

import { randomUUID } from "node:crypto"
import { isDatabaseConfigured, query } from "@/lib/neon/postgres"
import { grantForPaidOrder, revokeGrantForOrder } from "@/lib/neon/agent-billing"

/**
 * Creem 测试收款通道（仅测试环境）。
 *
 * 定位：一次技术验证，不动 AaaS 的授权闸门与访问模式。
 *  - 支付成功 → 调 agent-billing 的 grantForPaidOrder() 发一份服务授权；
 *  - 退款 → revokeGrantForOrder() 作废。
 * Creem 侧只是 MoR，订单与授权的真源都在我们自己的 Postgres。
 *
 * 安全纪律：
 *  - 强制 creem_test_ 前缀的 key，拒绝任何 live key 落到测试通道；
 *  - 订单 id 由我们生成，作为 request_id 传给 Creem，webhook 回来精确对回，
 *    不信任 payload 里的 email / customer 来认人；
 *  - 授权发放幂等由 agent_service_grants.source_order_id UNIQUE 保证；
 *  - webhook 事件表只记审计，不用它 gate 核销（否则核销失败后重投会被挡死）。
 */

const CREEM_TEST_API_BASE = "https://test-api.creem.io/v1"

export class CreemError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message)
    this.name = "CreemError"
  }
}

/** 凭证是否齐备（不含 key 前缀校验，仅判断是否存在） */
export function isCreemConfigured(): boolean {
  return Boolean(process.env.CREEM_API_KEY && process.env.CREEM_PRODUCT_ID)
}

function requireCredentials(): { apiKey: string; productId: string } {
  const apiKey = process.env.CREEM_API_KEY ?? ""
  const productId = process.env.CREEM_PRODUCT_ID ?? ""
  if (!apiKey || !productId) {
    throw new CreemError(
      "CREEM_NOT_CONFIGURED",
      "未配置 CREEM_API_KEY / CREEM_PRODUCT_ID",
      503,
    )
  }
  if (!apiKey.startsWith("creem_test_")) {
    throw new CreemError(
      "CREEM_LIVE_KEY_REJECTED",
      "Creem 测试通道只接受 creem_test_ 前缀的 key",
      400,
    )
  }
  return { apiKey, productId }
}

export interface CreemCheckoutResult {
  orderId: string
  checkoutUrl: string
}

interface CreemCheckoutResponse {
  id?: string
  checkout_url?: string
  status?: string
  request_id?: string
}

/**
 * 为登录用户创建一笔测试结账会话。
 * @param subject 我们的用户主键（users.id::text）
 * @param successUrl 付款后回跳地址（绝对路径，由 route 层按请求 origin 构造）
 * @param email 可选，预填到 Creem 结账页；仅用于展示，不用于认人
 */
export async function createCreemCheckout(input: {
  subject: string
  successUrl: string
  email?: string | null
}): Promise<CreemCheckoutResult> {
  if (!isDatabaseConfigured()) {
    throw new CreemError("DB_NOT_CONFIGURED", "数据库未配置", 503)
  }
  if (!input.subject) {
    throw new CreemError("SUBJECT_REQUIRED", "缺少用户标识", 400)
  }
  const { apiKey, productId } = requireCredentials()

  const orderId = `creem_${randomUUID()}`
  const body: Record<string, unknown> = {
    product_id: productId,
    request_id: orderId,
    success_url: input.successUrl,
    metadata: { subject: input.subject, orderId, source: "coolha_creem_test" },
  }
  if (input.email) body.customer = { email: input.email }

  let checkout: CreemCheckoutResponse
  try {
    const res = await fetch(`${CREEM_TEST_API_BASE}/checkouts`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    })
    const text = await res.text()
    if (!res.ok) {
      console.error("[creem] 创建 checkout 失败:", res.status, text.slice(0, 500))
      throw new CreemError("CREEM_CHECKOUT_FAILED", "创建结账会话失败", 502)
    }
    checkout = JSON.parse(text) as CreemCheckoutResponse
  } catch (error) {
    if (error instanceof CreemError) throw error
    console.error("[creem] 创建 checkout 异常:", error)
    throw new CreemError("CREEM_CHECKOUT_FAILED", "创建结账会话失败", 502)
  }

  if (!checkout.checkout_url) {
    throw new CreemError("CREEM_NO_CHECKOUT_URL", "Creem 未返回结账地址", 502)
  }

  await query(
    `INSERT INTO creem_orders
       (id, subject, product_id, status, checkout_id, checkout_url, customer_email, raw_event)
     VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [
      orderId,
      input.subject,
      productId,
      checkout.id ?? null,
      checkout.checkout_url,
      input.email ?? null,
      JSON.stringify(checkout),
    ],
  )

  return { orderId, checkoutUrl: checkout.checkout_url }
}

type OrderRow = {
  id: string
  subject: string
  product_id: string
  status: string
  checkout_id: string | null
  grant_id: string | null
  amount_cents: number | null
}

/** 只记审计，不用它 gate 核销（见文件头纪律） */
export async function recordCreemWebhookEvent(input: {
  eventId: string
  eventType: string
  orderId: string | null
  rawPayload: unknown
}): Promise<boolean> {
  if (!isDatabaseConfigured() || !input.eventId) return false
  try {
    const { rowCount } = await query(
      `INSERT INTO creem_webhook_events (event_id, event_type, order_id, raw_payload)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (event_id) DO NOTHING`,
      [input.eventId, input.eventType, input.orderId, JSON.stringify(input.rawPayload ?? {})],
    )
    return (rowCount ?? 0) > 0
  } catch (error) {
    console.error("[creem] 记录 webhook 事件失败:", error)
    return false
  }
}

export type FulfillResult =
  | { status: "granted"; grantId: string }
  | { status: "duplicate"; grantId: string }
  | { status: "not_found" }
  | { status: "invalid"; reason: string }

/**
 * checkout.completed / subscription.paid 核销：发授权并把订单迁入 paid。
 * 幂等三重保险：订单状态机 + source_order_id UNIQUE + 重复的 grant id 回读。
 */
export async function fulfillCreemCheckout(input: {
  requestId: string | null
  checkoutId?: string | null
  creemOrderId?: string | null
  transactionId?: string | null
  subscriptionId?: string | null
  customerId?: string | null
  customerEmail?: string | null
  amountCents?: number | null
  rawEvent?: unknown
}): Promise<FulfillResult> {
  if (!isDatabaseConfigured() || !input.requestId) return { status: "not_found" }

  const { rows } = await query<OrderRow>(
    `SELECT id, subject, product_id, status, checkout_id, grant_id, amount_cents
       FROM creem_orders WHERE id = $1 LIMIT 1`,
    [input.requestId],
  )
  const order = rows[0]
  if (!order) {
    console.warn("[creem] 核销时找不到订单:", input.requestId)
    return { status: "not_found" }
  }

  // 串单防护：订单已绑定 checkout 时，回调带来的 checkout id 必须一致
  if (order.checkout_id && input.checkoutId && order.checkout_id !== input.checkoutId) {
    return { status: "invalid", reason: "checkout_id 与订单不匹配" }
  }

  if (order.status === "paid" && order.grant_id) {
    return { status: "duplicate", grantId: order.grant_id }
  }
  if (order.status === "refunded") {
    return { status: "invalid", reason: "订单已退款，不能重新发放授权" }
  }

  // grantForPaidOrder 自身幂等（source_order_id UNIQUE），重复回调不会发第二份
  const priceUsd =
    typeof input.amountCents === "number" && Number.isFinite(input.amountCents)
      ? input.amountCents / 100
      : undefined
  const grantId = await grantForPaidOrder({
    subject: order.subject,
    orderId: order.id,
    priceUsd,
  })
  if (!grantId) {
    return { status: "invalid", reason: "授权发放失败" }
  }

  await query(
    `UPDATE creem_orders
        SET status = 'paid',
            grant_id = $2,
            amount_cents = COALESCE(amount_cents, $3),
            checkout_id = COALESCE(checkout_id, $4),
            creem_order_id = COALESCE(creem_order_id, $5),
            transaction_id = COALESCE(transaction_id, $6),
            subscription_id = COALESCE(subscription_id, $7),
            customer_id = COALESCE(customer_id, $8),
            customer_email = COALESCE(customer_email, $9),
            paid_at = now(),
            raw_event = COALESCE($10, raw_event),
            updated_at = now()
      WHERE id = $1 AND status <> 'refunded'`,
    [
      order.id,
      grantId,
      input.amountCents ?? null,
      input.checkoutId ?? null,
      input.creemOrderId ?? null,
      input.transactionId ?? null,
      input.subscriptionId ?? null,
      input.customerId ?? null,
      input.customerEmail ?? null,
      input.rawEvent ? JSON.stringify(input.rawEvent) : null,
    ],
  )

  return { status: "granted", grantId }
}

/** 退款 / 拒付：作废授权并让订单单向迁入 refunded */
export async function revokeCreemOrder(input: {
  requestId: string | null
  rawEvent?: unknown
}): Promise<{ status: "revoked" | "not_found" | "invalid" }> {
  if (!isDatabaseConfigured() || !input.requestId) return { status: "not_found" }
  const { rows } = await query<{ id: string; status: string }>(
    `SELECT id, status FROM creem_orders WHERE id = $1 LIMIT 1`,
    [input.requestId],
  )
  const order = rows[0]
  if (!order) return { status: "not_found" }
  if (order.status === "refunded") return { status: "invalid" }

  await revokeGrantForOrder(order.id)
  await query(
    `UPDATE creem_orders
        SET status = 'refunded', refunded_at = now(), updated_at = now(),
            raw_event = COALESCE($2, raw_event)
      WHERE id = $1`,
    [order.id, input.rawEvent ? JSON.stringify(input.rawEvent) : null],
  )
  return { status: "revoked" }
}

export interface CreemOrderView {
  id: string
  productId: string
  status: string
  amountCents: number | null
  currency: string
  createdAt: string
  paidAt: string | null
}

/** 我的 Creem 测试订单（按 subject 过滤，物理隔离） */
export async function listCreemOrders(subject: string, limit = 20): Promise<CreemOrderView[]> {
  if (!isDatabaseConfigured() || !subject) return []
  try {
    const { rows } = await query<{
      id: string
      product_id: string
      status: string
      amount_cents: number | null
      currency: string
      created_at: Date
      paid_at: Date | null
    }>(
      `SELECT id, product_id, status, amount_cents, currency, created_at, paid_at
         FROM creem_orders WHERE subject = $1
        ORDER BY created_at DESC LIMIT $2`,
      [subject, limit],
    )
    return rows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      status: r.status,
      amountCents: r.amount_cents,
      currency: r.currency,
      createdAt: r.created_at.toISOString(),
      paidAt: r.paid_at ? r.paid_at.toISOString() : null,
    }))
  } catch (error) {
    console.error("[creem] 读取订单失败:", error)
    return []
  }
}
