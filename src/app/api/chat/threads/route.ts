import {
  ChatHistoryError,
  authorizeHistory,
  createThread,
  listThreads,
} from "@/lib/neon/chat-history"

export const dynamic = "force-dynamic"

function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status })
}

/** 我的会话列表 */
export async function GET() {
  const auth = await authorizeHistory()
  if (!auth.ok) return fail(auth.status, auth.code, auth.message)
  try {
    const threads = await listThreads(auth.subject, auth.plan)
    return Response.json({ plan: auth.plan.id, threads })
  } catch (error) {
    console.error("[chat/threads] 列表失败:", error)
    return fail(500, "INTERNAL", "读取会话列表失败")
  }
}

/** 新建会话 */
export async function POST(req: Request) {
  const auth = await authorizeHistory()
  if (!auth.ok) return fail(auth.status, auth.code, auth.message)

  let body: { id?: unknown; title?: unknown; modelKey?: unknown } = {}
  try {
    body = (await req.json()) as typeof body
  } catch {
    // 允许空体
  }

  try {
    const thread = await createThread(auth.subject, auth.plan, {
      id: typeof body.id === "string" ? body.id : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
    })
    return Response.json({ thread })
  } catch (error) {
    if (error instanceof ChatHistoryError) {
      const status =
        error.code === "THREAD_LIMIT" ? 409 : error.code === "INVALID_PAYLOAD" ? 400 : 400
      return fail(status, error.code, error.message)
    }
    console.error("[chat/threads] 创建失败:", error)
    return fail(500, "INTERNAL", "创建会话失败")
  }
}
