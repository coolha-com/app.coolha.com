import { requireRwaSubject } from "@/lib/agents/http"
import { getChatSession, updateChatSession } from "@/lib/neon/chat-sessions"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response
  const { id } = await params
  try {
    const session = await getChatSession(auth.subject, id)
    if (!session) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "会话不存在" } },
        { status: 404 },
      )
    }
    return Response.json({ session })
  } catch (error) {
    console.error("[sessions] 读取会话失败:", error)
    return Response.json(
      { error: { code: "GET_FAILED", message: "读取会话失败" } },
      { status: 500 },
    )
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response
  const { id } = await params

  let body: {
    eveSession?: unknown
    eveEvents?: unknown
    transcript?: unknown
    preview?: unknown
    title?: unknown
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "请求体不是合法 JSON" } },
      { status: 400 },
    )
  }

  try {
    await updateChatSession({
      subject: auth.subject,
      id,
      eveSession: body.eveSession,
      eveEvents: Array.isArray(body.eveEvents) ? body.eveEvents : undefined,
      transcript: Array.isArray(body.transcript) ? body.transcript : undefined,
      preview: typeof body.preview === "string" ? body.preview.slice(0, 500) : undefined,
      title: typeof body.title === "string" ? body.title.slice(0, 200) : undefined,
    })
    return Response.json({ ok: true })
  } catch (error) {
    console.error("[sessions] 更新会话失败:", error)
    return Response.json(
      { error: { code: "UPDATE_FAILED", message: "更新会话失败" } },
      { status: 500 },
    )
  }
}
