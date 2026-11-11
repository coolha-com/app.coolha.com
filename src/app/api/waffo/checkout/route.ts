import { randomUUID } from "node:crypto"

import { getCurrentUser } from "@/lib/neon/session"
import { createWaffoOrder, setWaffoCheckoutUrl } from "@/lib/neon/waffo"
import { getWaffoClient, getWaffoConfig, WaffoConfigError } from "@/lib/waffo/client"

export const dynamic = "force-dynamic"

/**
 * 创建 Waffo 收银台会话。
 *
 * 流程：登录用户 → 我们先建 pending 订单 → 用 SDK 开一个 checkout session →
 * 把 checkoutUrl 交给前端跳转 → 用户付款 → Waffo 打 /webhook → 核销为 paid。
 *
 * 为什么用 SDK 而不是硬编码商品链接：
 *  - 硬链接拿不到「谁付的」，回调无法归属到账号；
 *  - SDK 的 authenticated checkout 会签发 buyerIdentity，
 *    我们再把自己的单号塞进 orderMerchantExternalId，回调时能精确对回用户。
 *
 * ⚠️ 必须登录：未登录的订单无法归属，也就无法发放权益。
 */

/** 我们自己的单号；作为 orderMerchantExternalId 传给 Waffo（≤128 字符） */
function newOrderId(): string {
  return `WO_${randomUUID().replace(/-/g, "")}`
}

/**
 * 支付完成后的回跳地址。
 *
 * 只信任请求自身的 Host，不用 Origin 头——Origin 可被跨站伪造，
 * 拿它拼回跳地址等于给钓鱼开一条路。
 *
 * returnTo 只允许站内绝对路径（单斜杠开头），避免被拼成站外地址。
 */
function resolveSuccessUrl(req: Request, orderId: string, returnTo?: string): string | undefined {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? ""
  if (!host) return undefined
  const proto = req.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https")
  const back =
    typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/billing/subscription"
  const separator = back.includes("?") ? "&" : "?"
  return `${proto}://${host}${back}${separator}paid=1&order=${orderId}`
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json(
      { error: { code: "AUTH_REQUIRED", message: "请先登入再购买" } },
      { status: 401 },
    )
  }

  let config: ReturnType<typeof getWaffoConfig>
  let client: ReturnType<typeof getWaffoClient>
  try {
    config = getWaffoConfig()
    client = getWaffoClient()
  } catch (error) {
    if (error instanceof WaffoConfigError) {
      console.error("[waffo/checkout] 配置缺失:", error.code, error.message)
      return Response.json(
        { error: { code: error.code, message: "支付服务暂不可用，请稍后重试" } },
        { status: 503 },
      )
    }
    throw error
  }

  const orderId = newOrderId()
  const amount = "19.00"

  let returnTo: string | undefined
  try {
    const parsed = (await req.json().catch(() => null)) as { returnTo?: unknown } | null
    if (typeof parsed?.returnTo === "string") returnTo = parsed.returnTo
  } catch {
    // 没有 body 也允许（默认回账单页）
  }

  // 先建单再开收银台：没有账本就不收款，否则回调无法归属。
  const order = await createWaffoOrder({
    id: orderId,
    subject: user.subject,
    productId: config.productId,
    currency: config.currency,
    amount,
    buyerEmail: user.email,
    buyerIdentity: user.subject,
  })
  if (!order) {
    return Response.json(
      { error: { code: "ORDER_LEDGER_UNAVAILABLE", message: "订单账本不可用，请稍后重试" } },
      { status: 503 },
    )
  }

  try {
    const result = await client.checkout.authenticated.create({
      productId: config.productId,
      currency: config.currency,
      // buyerIdentity 走 issue-session-token，其余字段走 create-session
      buyerIdentity: user.subject,
      buyerEmail: user.email ?? undefined,
      // 我们自己的单号：回调据此归属账号
      orderMerchantExternalId: orderId,
      successUrl: resolveSuccessUrl(req, orderId, returnTo),
      expiresInSeconds: 30 * 60,
      metadata: { subject: user.subject, source: "coolha" },
    })

    await setWaffoCheckoutUrl(orderId, result.checkoutUrl)

    return Response.json({
      orderId,
      checkoutUrl: result.checkoutUrl,
      expiresAt: result.expiresAt ?? null,
      environment: config.environment,
    })
  } catch (error) {
    console.error("[waffo/checkout] 创建收银台失败:", error)
    const message =
      error instanceof Error && error.message ? error.message : "创建收银台失败"
    return Response.json(
      { error: { code: "CHECKOUT_CREATE_FAILED", message } },
      { status: 502 },
    )
  }
}
