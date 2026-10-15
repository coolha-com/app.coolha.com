import { expireStaleOrders, countPendingOrders } from "@/lib/neon/subscription"
import { syncAll } from "@/lib/subscription/scan"

export const dynamic = "force-dynamic"

/**
 * Vercel Cron：入账兜底。
 * 只在存在未过期的 pending 订单时才扫链，避免空转消耗 RPC 配额。
 * 鉴权：Vercel Cron 自动带 `Authorization: Bearer $CRON_SECRET`。
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? ""
  if (!secret) {
    return Response.json({ error: { code: "CRON_DISABLED" } }, { status: 503 })
  }
  const header = req.headers.get("authorization") ?? ""
  if (header !== `Bearer ${secret}`) {
    return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })
  }

  const expired = await expireStaleOrders()
  const pending = await countPendingOrders()
  if (pending === 0) {
    return Response.json({ ok: true, expired, pending, scanned: 0, granted: 0, skipped: true })
  }

  const result = await syncAll()
  return Response.json({
    ok: true,
    expired,
    pending,
    scanned: result.scanned,
    granted: result.granted,
    skipped: result.skipped,
  })
}
