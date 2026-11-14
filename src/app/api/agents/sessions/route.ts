import { requireRwaSubject } from "@/lib/agents/http"
import { decideAgentAccess } from "@/lib/agents/access-mode"
import { createChatSession, listChatSessions } from "@/lib/neon/chat-sessions"
import {
  attachGrantToSession,
  findUsableGrant,
  readOpenModeBudget,
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

  // 开放测试模式不要求授权，但仍受 24 小时测试预算限制。
  // 关闭模式（含生产）必须已有有效授权。不读取客户端传来的访问模式。
  const access = decideAgentAccess()
  let grantId: string | null = null
  if (access.open) {
    const budget = await readOpenModeBudget(auth.subject)
    if (budget.reason === "unavailable") {
      return Response.json(
        { error: { code: "BUDGET_UNAVAILABLE", message: "暂时无法确认测试预算，已拒绝创建任务" } },
        { status: 503 },
      )
    }
    if (budget.blocked) {
      return Response.json(
        {
          error: {
            code: "QUOTA_EXHAUSTED",
            message: "开发测试预算已用完，暂时不能开始新任务",
          },
        },
        { status: 402 },
      )
    }
  } else {
    const grant = await findUsableGrant(auth.subject)
    if (!grant) {
      return Response.json(
        {
          error: {
            code: "PAYMENT_REQUIRED",
            message: "当前环境未开放未经授权的 Agent 执行",
          },
        },
        { status: 402 },
      )
    }
    grantId = grant.id
  }

  try {
    const created = await createChatSession({
      id,
      subject: auth.subject,
      agentId,
      title,
      config,
    })
    if (grantId) {
      await attachGrantToSession({
        sessionId: created,
        subject: auth.subject,
        grantId,
      })
    }
    return Response.json({ id: created, grantId, accessMode: access.mode })
  } catch (error) {
    console.error("[sessions] 创建会话失败:", error)
    return Response.json(
      { error: { code: "CREATE_FAILED", message: "创建会话失败" } },
      { status: 500 },
    )
  }
}
