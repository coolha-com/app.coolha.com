import { createHmac, timingSafeEqual } from "node:crypto"
import {
  fulfillCreemCheckout,
  recordCreemWebhookEvent,
  revokeCreemOrder,
} from "@/lib/neon/creem"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Creem Webhook（测试环境）。
 *
 * 验签：raw body + HMAC-SHA256 hex，与 creem-signature 头用 timingSafeEqual 比对。
 * 未配置 CREEM_WEBHOOK_SECRET 时直接 503，不留开放授予入口。
 *
 * 事件路由：
 *  - checkout.completed / subscription.active / subscription.paid → 发放授权
 *  - refund.created / dispute.created → 作废授权
 * 其余事件只记审计、返回 ok。
 *
 * 幂等：Creem 会重投（最多 5 次，事件 id 不变）。核销侧靠订单状态机 +
 * source_order_id UNIQUE 保证不重复发放/复活；事件表只记审计，不用它 gate。
 * 请求 id 从 object.request_id 取，缺失时回退 metadata.orderId。
 */

function verifySignature(raw: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = createHmac("sha256", secret).update(raw).digest("hex")
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(signature, "utf8")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

type AnyObject = Record<string, unknown>

function asObject(value: unknown): AnyObject | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AnyObject)
    : null
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function intFromCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  return null
}

export async function POST(req: Request) {
  const secret = process.env.CREEM_WEBHOOK_SECRET ?? ""
  if (!secret) {
    return Response.json(
      { error: { code: "WEBHOOK_DISABLED", message: "未配置 CREEM_WEBHOOK_SECRET" } },
      { status: 503 },
    )
  }

  const raw = await req.text()
  if (!verifySignature(raw, req.headers.get("creem-signature"), secret)) {
    return Response.json({ error: { code: "BAD_SIGNATURE" } }, { status: 401 })
  }

  let payload: AnyObject
  try {
    payload = JSON.parse(raw) as AnyObject
  } catch {
    return Response.json({ error: { code: "INVALID_JSON" } }, { status: 400 })
  }

  const eventId = str(payload.id) ?? ""
  const eventType = str(payload.eventType) ?? ""
  const object = asObject(payload.object) ?? {}
  const metadata = asObject(object.metadata) ?? {}

  // 订单号：request_id 是主通道，metadata.orderId 是双保险
  const requestId = str(object.request_id) ?? str(metadata.orderId)

  // 先记审计（失败不影响核销）
  await recordCreemWebhookEvent({
    eventId,
    eventType,
    orderId: requestId,
    rawPayload: payload,
  })

  const grantEvents = new Set(["checkout.completed", "subscription.active", "subscription.paid"])
  const revokeEvents = new Set(["refund.created", "dispute.created"])

  if (grantEvents.has(eventType)) {
    const order = asObject(object.order) ?? {}
    const customer = asObject(object.customer) ?? {}
    const subscription = asObject(object.subscription) ?? {}
    const result = await fulfillCreemCheckout({
      requestId,
      checkoutId: str(object.id),
      creemOrderId: str(order.id),
      transactionId: str(order.transaction),
      subscriptionId: str(subscription.id),
      customerId: str(customer.id),
      customerEmail: str(customer.email),
      amountCents: intFromCents(order.amount_paid),
      rawEvent: payload,
    })
    console.info("[creem] 核销事件:", eventType, requestId, result.status)
    // invalid 也回 200：业务冲突重投无意义；true 的传输失败才交给 Creem 重试
    return Response.json({ ok: true, eventType, result })
  }

  if (revokeEvents.has(eventType)) {
    const result = await revokeCreemOrder({ requestId, rawEvent: payload })
    console.info("[creem] 作废事件:", eventType, requestId, result.status)
    return Response.json({ ok: true, eventType, result })
  }

  return Response.json({ ok: true, eventType, ignored: true })
}
