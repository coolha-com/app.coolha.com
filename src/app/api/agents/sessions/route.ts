import { requireRwaSubject } from "@/lib/agents/http"
import { createChatSession, listChatSessions } from "@/lib/neon/chat-sessions"
import {
  attachGrantToSession,
  findUsableGrant,
} from "@/lib/neon/agent-billing"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response
  try {
    const sessions = await listChatSessions(auth.subject)
    return Response.json({ sessions })
  } catch (error) {
    console.error("[sessions] 读取会话列表失败:", error)
    return Response.json(
      { error: { code: "LIST_FAILED", message: "读取会话失败" } },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response

  let body: { id?: unknown; agentId?: unknown; title?: unknown; config?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "请求体不是合法 JSON" } },
      { status: 400 },
    )
  }

  const id =
    typeof body.id === "string" && body.id.length > 0 && body.id.length <= 64
      ? body.id
      : crypto.randomUUID()
  const agentId = typeof body.agentId === "string" ? body.agentId : "coolha-rwa"
  const title = typeof body.title === "string" ? body.title.slice(0, 200) : "新任务"
  const config =
    body.config && typeof body.config === "object" ? (body.config as Record<string, unknown>) : {}

  // 付费闸门：开始一次任务必须有一份有效的服务授权（19 U/次，30 天，token 价值上限 10 美元）。
  // 没有可用授权 → 402，前端据此展示收银台。
  const grant = await findUsableGrant(auth.subject)
  if (!grant) {
    return Response.json(
      {
        error: {
          code: "PAYMENT_REQUIRED",
          message: "还没有可用的服务授权，请先购买后再开始任务",
        },
      },
      { status: 402 },
    )
  }

  try {
    const created = await createChatSession({
      id,
      subject: auth.subject,
      agentId,
      title,
      config,
    })
    // 会话绑定授权：推理计量据此扣减这份授权的额度
    await attachGrantToSession({
      sessionId: created,
      subject: auth.subject,
      grantId: grant.id,
    })
    return Response.json({ id: created, grantId: grant.id })
  } catch (error) {
    console.error("[sessions] 创建会话失败:", error)
    return Response.json(
      { error: { code: "CREATE_FAILED", message: "创建会话失败" } },
      { status: 500 },
    )
  }
}
