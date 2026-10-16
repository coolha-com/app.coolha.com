import { authorizeHistory, purgeHistory } from "@/lib/neon/chat-history"

export const dynamic = "force-dynamic"

function fail(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status })
}

/**
 * 一键清空云端历史（硬删除，不可恢复）。
 * 用户隐私承诺的落地点：设置里必须能一键清空，且删除的是全部会话与消息。
 */
export async function DELETE() {
  const auth = await authorizeHistory()
  if (!auth.ok) return fail(auth.status, auth.code, auth.message)
  try {
    const removed = await purgeHistory(auth.subject)
    return Response.json({ ok: true, removed })
  } catch (error) {
    console.error("[chat/history] 清空失败:", error)
    return fail(500, "INTERNAL", "清空云端历史失败")
  }
}
