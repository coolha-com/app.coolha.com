import {
  ChatHistoryError,
  authorizeHistory,
  replaceMessages,
} from "@/lib/neon/chat-history"

export const dynamic = "force-dynamic"

function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status })
}

type Context = { params: Promise<{ id: string }> }

/** 全量上报本会话消息（每次交互后整体覆盖，幂等） */
export async function PUT(req: Request, { params }: Context) {
  const auth = await authorizeHistory()
  if (!auth.ok) return fail(auth.status, auth.code, auth.message)
  const { id } = await params

  let body: { messages?: unknown; title?: unknown; modelKey?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return fail(400, "INVALID_JSON", "请求体不是合法 JSON")
  }

  try {
    await replaceMessages(auth.subject, id, body.messages, {
      title: typeof body.title === "string" ? body.title : undefined,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
    })
    return Response.json({ ok: true })
  } catch (error) {
    if (error instanceof ChatHistoryError) {
      const status =
        error.code === "THREAD_NOT_FOUND"
          ? 404
          : error.code === "TOO_MANY_MESSAGES"
            ? 413
            : 400
      return fail(status, error.code, error.message)
    }
    console.error("[chat/threads/:id/messages] 写入失败:", error)
    return fail(500, "INTERNAL", "保存会话消息失败")
  }
}
