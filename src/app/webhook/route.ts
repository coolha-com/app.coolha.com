import {
  verifyWebhook,
  WebhookEventType,
  type WebhookEvent,
  type WebhookEventData,
} from "@waffo/pancake-ts"

import {
  hasProcessedWaffoEvent,
  markWaffoOrderPaid,
  markWaffoOrderRefunded,
  recordWaffoEvent,
} from "@/lib/neon/waffo"
import { grantForPaidOrder, revokeGrantForOrder } from "@/lib/neon/agent-billing"
import {
  getWaffoConfig,
  getWaffoWebhookVerifyOptions,
  WaffoConfigError,
} from "@/lib/waffo/client"

export const dynamic = "force-dynamic"

/**
 * Waffo Pancake 回调入口（根路由 `/webhook`）。
 *
 * 对应 Dashboard → 设置 → Webhooks → Test Webhook URL 填
 * `https://<你的域名>/webhook`，Format 选 **Raw**（只有 Raw 带 RSA-SHA256 签名）。
 *
 * 三条铁律（照抄官方 guide）：
 *  1. **必须读原始文本**。`await req.json()` 会重排空白，签名立刻对不上。
 *  2. **必须验签**。没有验签的回调端点 = 一个开放的授予入口。
 *  3. **必须幂等**。Waffo 在我们返回非 2xx 时会重投（最多 4 次，间隔约 12s / 2m28s / 30m8s）。
 *
 * 归属靠 `orderMerchantExternalId`——那是我们自己生成的单号（建单时塞进去的），
 * 所以不需要用邮箱去猜「谁付的」。
 *
 * ⚠️ 诚实边界：本端点负责**订单核销**（把 pending 变成 paid），并在核销成功时
 * **发放一份按次服务授权**（19 U/次 / 30 天 / token 价值上限 10 美元）。
 * 额度本身按**实际推理用量**扣减，不在回调里预扣。
 *
 * 补充（自己写本地联调脚本时注意）：`X-Waffo-Signature` 头里的 `t` 是
 * **毫秒**时间戳（SDK 内部用 `Date.now() - t` 算签名年龄），
 * 不是秒级 Unix 时间戳——写成秒会让验签卡在「超出容忍窗口」上。
 */

export async function POST(req: Request) {
  // ⚠️ 铁律 1：原始文本，不能 JSON.parse
  const raw = await req.text()
  const signature = req.headers.get("x-waffo-signature")

  let verifyOptions: { environment: "test" | "prod" }
  try {
    verifyOptions = getWaffoWebhookVerifyOptions()
  } catch (error) {
    // 配置缺失属于「我这边的错」，回 503 让 Waffo 重投，而不是当成伪造请求丢掉
    const detail =
      error instanceof WaffoConfigError ? `${error.code}: ${error.message}` : String(error)
    console.error("[waffo/webhook] 验签配置缺失:", detail)
    return Response.json({ error: { code: "WEBHOOK_NOT_CONFIGURED" } }, { status: 503 })
  }

  // ⚠️ 铁律 2：验签
  let event: WebhookEvent<WebhookEventData>
  try {
    event = verifyWebhook<WebhookEventData>(raw, signature, verifyOptions)
  } catch (error) {
    console.error("[waffo/webhook] 验签失败:", error)
    return Response.json({ error: { code: "BAD_SIGNATURE" } }, { status: 401 })
  }

  const eventType = event.eventType
  const data = event.data ?? ({} as WebhookEventData)

  try {
    const config = getWaffoConfig()
    if (event.mode && event.mode !== config.environment) {
      console.warn(
        `[waffo/webhook] 事件 mode=${event.mode} 与本地环境 ${config.environment} 不一致`,
      )
    }
  } catch {
    // 环境读不到不影响处理，继续
  }

  // ⚠️ 铁律 3：幂等。前置查一次只是为了省掉重复处理；
  // 真正的保证在状态机（markWaffoOrderPaid 只认 pending → paid）。
  if (await hasProcessedWaffoEvent(event.id)) {
    return Response.json({ ok: true, duplicate: true })
  }

  const externalId = data.orderMerchantExternalId ?? null
  let outcome: string

  try {
    switch (eventType) {
      case WebhookEventType.OrderCompleted: {
        if (!externalId) {
          // 例如直接在 Dashboard 商品页下单：没有我们的单号，无法归属账号
          console.warn(
            "[waffo/webhook] order.completed 缺少 orderMerchantExternalId，无法归属账号:",
            data.orderId,
          )
          outcome = "unattributed"
          break
        }
        const paid = await markWaffoOrderPaid({
          id: externalId,
          waffoOrderId: data.orderId,
          waffoPaymentId: data.paymentId ?? null,
          amount: data.listPrice?.total ?? data.total ?? "",
          currency: data.currency,
          rawEvent: event,
        })
        outcome = paid ? "paid" : "already_paid"
        if (paid) {
          // 核销成功 → 发放一份按次服务授权（19 U/次，30 天，token 价值上限 10 美元）。
          // 归因优先用下单时塞进 metadata 的 subject，其次用 buyerIdentity；
          // 都拿不到就不发放（宁可少发，也不错发给别的账号）。
          const subject = data.orderMetadata?.subject ?? data.merchantProvidedBuyerIdentity ?? null
          if (subject) {
            const grantId = await grantForPaidOrder({
              subject: String(subject),
              orderId: externalId,
            })
            outcome = grantId ? "paid+granted" : "paid"
          }
        }
        break
      }

      case WebhookEventType.RefundSucceeded: {
        if (!externalId) {
          console.warn("[waffo/webhook] refund.succeeded 缺少 orderMerchantExternalId:", data.orderId)
          outcome = "unattributed"
          break
        }
        const refunded = await markWaffoOrderRefunded(externalId, data.orderId, event)
        // 退款 → 作废这份授权（已耗尽的保留原状态，如实记录）
        await revokeGrantForOrder(externalId)
        outcome = refunded ? "refunded" : "already_refunded"
        break
      }

      default: {
        // 订阅类事件：一次性购买模型用不到，只记账不处理
        outcome = "ignored"
        break
      }
    }
  } catch (error) {
    // 处理失败要回 5xx，让 Waffo 按退避策略重投；此时**不写**事件记录，
    // 否则这次投递会被去重挡掉，订单永远核销不了。
    console.error("[waffo/webhook] 处理事件失败:", error)
    return Response.json({ error: { code: "HANDLER_FAILED" } }, { status: 500 })
  }

  // 处理成功后才记事件 id（此时再重复投递会被安全跳过）
  await recordWaffoEvent(event.id, eventType, data.orderId ?? null)

  return Response.json({ ok: true, outcome })
}
