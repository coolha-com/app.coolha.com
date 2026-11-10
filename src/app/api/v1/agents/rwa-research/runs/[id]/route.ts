import { jsonError } from "@/lib/agents/http"
import { requireAgentApiKey } from "@/lib/agents/api-auth"
import { RWA_COMMERCIAL } from "@/lib/agents/rwa-research"
import { getRwaRun } from "@/lib/neon/rwa-research"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ORDER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAgentApiKey(req)
  if (!auth.ok) return auth.response
  const { id } = await context.params
  if (!ORDER_ID_RE.test(id)) return jsonError(400, "INVALID_ID", "执行记录编号不正确")
  const run = await getRwaRun(auth.subject, id)
  if (!run) return jsonError(404, "NOT_FOUND", "没有这条执行记录")
  return Response.json({ run, commercial: RWA_COMMERCIAL })
}
