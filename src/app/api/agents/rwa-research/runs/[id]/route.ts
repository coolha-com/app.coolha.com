import { jsonError, requireRwaSubject } from "@/lib/agents/http"
import { RWA_COMMERCIAL } from "@/lib/agents/rwa-research"
import { getRwaRun } from "@/lib/neon/rwa-research"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ORDER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  if (!ORDER_ID_RE.test(id)) return jsonError(400, "INVALID_ID", "执行记录编号不正确")

  try {
    const run = await getRwaRun(auth.subject, id)
    if (!run) return jsonError(404, "NOT_FOUND", "没有这条执行记录")
    return Response.json({ run, commercial: RWA_COMMERCIAL })
  } catch (error) {
    console.error("[rwa-research] 读取单条执行记录失败:", error instanceof Error ? error.name : "error")
    return jsonError(500, "RUN_READ_FAILED", "读取执行记录失败")
  }
}
