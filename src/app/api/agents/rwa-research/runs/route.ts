import { RwaResearchError, executeRwaResearch } from "@/lib/agents/execute"
import { jsonError, readGeoTier, rejectHardBlock, requireRwaSubject } from "@/lib/agents/http"
import { containsSecretValue, isTargetType, RWA_COMMERCIAL } from "@/lib/agents/rwa-research"
import { listRwaRuns } from "@/lib/neon/rwa-research"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function GET() {
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response
  try {
    const runs = await listRwaRuns(auth.subject)
    return Response.json({ runs, commercial: RWA_COMMERCIAL })
  } catch (error) {
    console.error("[rwa-research] 读取执行记录失败:", error instanceof Error ? error.name : "error")
    return jsonError(500, "RUN_LIST_FAILED", "读取执行记录失败")
  }
}

export async function POST(req: Request) {
  const blocked = rejectHardBlock(req)
  if (blocked) return blocked
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response

  let body: { task?: unknown; targetType?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonError(400, "INVALID_JSON", "请求体不是合法 JSON")
  }

  const task = typeof body.task === "string" ? body.task : ""
  if (containsSecretValue(task)) {
    return jsonError(400, "SECRET_REJECTED", "任务文本里不能包含密钥")
  }
  const targetType = isTargetType(body.targetType) ? body.targetType : "contract"

  try {
    const run = await executeRwaResearch({
      subject: auth.subject,
      task,
      targetType,
      channel: "web",
      geoTier: readGeoTier(req),
      allowSponsoredNarrative: true,
    })
    return Response.json({ run, commercial: RWA_COMMERCIAL })
  } catch (error) {
    if (error instanceof RwaResearchError) {
      return jsonError(error.status, error.code, error.message)
    }
    console.error("[rwa-research] 执行失败:", error instanceof Error ? error.name : "error")
    return jsonError(500, "EXECUTION_FAILED", "研究执行失败")
  }
}
