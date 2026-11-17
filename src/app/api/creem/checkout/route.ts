import { requireRwaSubject, rejectHardBlock } from "@/lib/agents/http"
import { getCurrentUser } from "@/lib/neon/session"
import { CreemError, createCreemCheckout, isCreemConfigured, listCreemOrders } from "@/lib/neon/creem"

export const dynamic = "force-dynamic"

/**
 * Creem 测试结账：为登录用户创建 checkout 会话。
 *
 * 这是支付通道的技术验证入口，不改变 Agent 的访问模式。
 * 付款成功后由 webhook 发放一份服务授权（见 /api/creem/webhook）。
 */
function successUrlFrom(req: Request): string {
  const configured = process.env.CREEM_SUCCESS_URL
  if (configured && configured.length > 0) return configured
  const origin = req.headers.get("origin")
  if (origin && /^https?:\/\//.test(origin)) return `${origin.replace(/\/$/, "")}/billing`
  return "/billing"
}

export async function POST(req: Request) {
  const blocked = rejectHardBlock(req)
  if (blocked) return blocked

  if (!isCreemConfigured()) {
    return Response.json(
      { error: { code: "CREEM_NOT_CONFIGURED", message: "Creem 测试收款未配置" } },
      { status: 503 },
    )
  }

  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response

  const user = await getCurrentUser()
  const email = user?.email ?? null

  try {
    const result = await createCreemCheckout({
      subject: auth.subject,
      successUrl: successUrlFrom(req),
      email,
    })
    return Response.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof CreemError) {
      return Response.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      )
    }
    console.error("[creem] 创建结账失败:", error)
    return Response.json(
      { error: { code: "CHECKOUT_FAILED", message: "创建结账会话失败" } },
      { status: 500 },
    )
  }
}

/** 我的 Creem 测试订单列表 */
export async function GET() {
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response
  const orders = await listCreemOrders(auth.subject)
  return Response.json({ orders })
}
