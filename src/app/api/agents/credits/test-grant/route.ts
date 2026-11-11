import { randomUUID } from "node:crypto"

import { requireRwaSubject } from "@/lib/agents/http"
import { grantForPaidOrder } from "@/lib/neon/agent-billing"
import { createTestPaidWaffoOrder } from "@/lib/neon/waffo"
import { getWaffoConfig, isWaffoTestMode } from "@/lib/waffo/client"
import { AGENT_SERVICE_PRICE_USD } from "@/lib/agents/billing-config"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * 测试模式专用：本地直接发放一份服务授权（不走 Waffo 沙箱收银台）。
 *
 * 为什么需要它：完整链路是「下单 → 支付 → webhook 核销 → 发放授权 → 会话 → 计量」。
 * 本地联调时不必真去沙箱付一次款，这个端点补上「已支付订单 + 授权」这一步，
 * 让后面所有环节（会话绑定、token 计量、额度用满即拒）都能被真实地跑到。
 *
 * ⚠️ 严格限死：只有 WAFFO_ENVIRONMENT=test 时才允许。
 * 生产环境调用一律 403 —— 这里绝不能成为「免费发额度」的后门。
 */
export async function POST() {
  if (!isWaffoTestMode()) {
    return Response.json(
      { error: { code: "NOT_TEST_MODE", message: "仅测试模式可用" } },
      { status: 403 },
    )
  }
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response

  let config: ReturnType<typeof getWaffoConfig>
  try {
    config = getWaffoConfig()
  } catch {
    return Response.json(
      { error: { code: "WAFFO_NOT_CONFIGURED", message: "支付服务未配置" } },
      { status: 503 },
    )
  }

  const orderId = `WO_TEST_${randomUUID().replace(/-/g, "")}`
  const order = await createTestPaidWaffoOrder({
    id: orderId,
    subject: auth.subject,
    productId: config.productId,
    currency: config.currency,
    amount: AGENT_SERVICE_PRICE_USD.toFixed(2),
    buyerEmail: null,
    buyerIdentity: auth.subject,
  })
  if (!order) {
    return Response.json(
      { error: { code: "ORDER_LEDGER_UNAVAILABLE", message: "订单账本不可用" } },
      { status: 503 },
    )
  }

  const grantId = await grantForPaidOrder({
    subject: auth.subject,
    orderId,
    priceUsd: AGENT_SERVICE_PRICE_USD,
  })
  if (!grantId) {
    return Response.json(
      { error: { code: "GRANT_FAILED", message: "发放服务授权失败" } },
      { status: 500 },
    )
  }

  return Response.json({ ok: true, orderId, grantId, testMode: true })
}
