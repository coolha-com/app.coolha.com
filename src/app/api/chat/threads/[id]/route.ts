import {
  ChatHistoryError,
  authorizeHistory,
  getThread,
  softDeleteThread,
  updateThread,
} from "@/lib/neon/chat-history"

export const dynamic = "force-dynamic"

function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status })
}

type Context = { params: Promise<{ id: string }> }

/** 读取会话与全部消息 */
export async function GET(_req: Request, { params }: Context) {
  const auth = await authorizeHistory()
  if (!auth.ok) return fail(auth.status, auth.code, auth.message)
  const { id } = await params
  try {
    const result = await getThread(auth.subject, id)
    if (!result) return fail(404, "THREAD_NOT_FOUND", "会话不存在或无权访问")
    return Response.json(result)
  } catch (error) {
    console.error("[chat/threads/:id] 读取失败:", error)
    return fail(500, "INTERNAL", "读取会话失败")
  }
}

/** 重命名 / 置顶 / 更新模型标识 */
export async function PATCH(req: Request, { params }: Context) {
  const auth = await authorizeHistory()
  if (!auth.ok) return fail(auth.status, auth.code, auth.message)
  const { id } = await params

  let body: { title?: unknown; pinned?: unknown; modelKey?: unknown } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    return fail(400, "INVALID_JSON", "请求体不是合法 JSON")
  }

  try {
    await updateThread(auth.subject, id, {
      title: typeof body.title === "string" ? body.title : undefined,
      pinned: typeof body.pinned === "boolean" ? body.pinned : undefined,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
    })
    return Response.json({ ok: true })
  } catch (error) {
    if (error instanceof ChatHistoryError) return fail(404, error.code, error.message)
    console.error("[chat/threads/:id] 更新失败:", error)
    return fail(500, "INTERNAL", "更新会话失败")
  }
}

/** 删除会话（软删除） */
export async function DELETE(_req: Request, { params }: Context) {
  const auth = await authorizeHistory()
  if (!auth.ok) return fail(auth.status, auth.code, auth.message)
  const { id } = await params
  try {
    await softDeleteThread(auth.subject, id)
    return Response.json({ ok: true })
  } catch (error) {
    if (error instanceof ChatHistoryError) return fail(404, error.code, error.message)
    console.error("[chat/threads/:id] 删除失败:", error)
    return fail(500, "INTERNAL", "删除会话失败")
  }
}
