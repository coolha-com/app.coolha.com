import { getCurrentUser } from "@/lib/neon/session"
import { getSubscriptionOrder } from "@/lib/neon/subscription"
import { isChainKey, isTokenSymbol } from "@/lib/subscription/config"
import { syncChainToken } from "@/lib/subscription/scan"

export const dynamic = "force-dynamic"

/**
 * 轮询订单状态。
 *
 * 带一个「被动兜底」：订单仍 pending 且距上次扫链超过 60s 时顺带扫一次。
 * 这样即使 Vercel Cron 未生效（如 Hobby 计划限制），用户轮询也能自行完成入账。
 * 节流是进程内 Map，跨实例不共享——仅作 best-effort，不替代 cron。
 */
const lastSyncAt = new Map<string, number>()
const SYNC_THROTTLE_MS = 60_000

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) {
    return Response.json(
      { error: { code: "AUTH_REQUIRED", message: "请先登入" } },
      { status: 401 },
    )
  }

  const subject = user.subject
  const order = await getSubscriptionOrder(id, subject)
  if (!order) {
    return Response.json(
      { error: { code: "ORDER_NOT_FOUND", message: "订单不存在" } },
      { status: 404 },
    )
  }

  if (order.status === "pending" && isChainKey(order.chain) && isTokenSymbol(order.token)) {
    const now = Date.now()
    if (now - (lastSyncAt.get(id) ?? 0) > SYNC_THROTTLE_MS) {
      lastSyncAt.set(id, now)
      await syncChainToken(order.chain, order.token)
      const refreshed = await getSubscriptionOrder(id, subject)
      return Response.json({ order: refreshed ?? order })
    }
  }

  return Response.json({ order })
}
