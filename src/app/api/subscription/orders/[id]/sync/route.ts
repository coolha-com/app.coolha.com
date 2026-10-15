import { getWalletSessionFromCookies } from "@/lib/neon/wallet-auth"
import { resolveSubject } from "@/lib/neon/identity"
import { getSubscriptionOrder } from "@/lib/neon/subscription"
import { isChainKey, isTokenSymbol } from "@/lib/subscription/config"
import { syncChainToken } from "@/lib/subscription/scan"

export const dynamic = "force-dynamic"

/** 强制扫一次该订单所在的 (chain, token)，用于「我已完成支付」后的即时确认 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const session = await getWalletSessionFromCookies()
  if (!session) {
    return Response.json(
      { error: { code: "AUTH_REQUIRED", message: "请先签名登录" } },
      { status: 401 },
    )
  }

  const subject = await resolveSubject(session.address)
  const order = await getSubscriptionOrder(id, subject)
  if (!order) {
    return Response.json(
      { error: { code: "ORDER_NOT_FOUND", message: "订单不存在" } },
      { status: 404 },
    )
  }
  if (!isChainKey(order.chain) || !isTokenSymbol(order.token)) {
    return Response.json(
      { error: { code: "INVALID_PAYMENT_OPTION", message: "订单支付信息异常" } },
      { status: 400 },
    )
  }
  if (order.status !== "pending") {
    return Response.json({ order })
  }

  // 手动确认时放宽回溯窗口（≈2.5 小时），覆盖用户慢慢转账的情况
  await syncChainToken(order.chain, order.token, { blocks: 4500 })
  const refreshed = await getSubscriptionOrder(id, subject)
  return Response.json({ order: refreshed ?? order })
}
