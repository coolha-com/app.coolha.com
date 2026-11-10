import { RwaResearchError, executeRwaResearch } from "@/lib/agents/execute"
import { jsonError, readGeoTier } from "@/lib/agents/http"
import { recordAgentCall, requireAgentApiKey } from "@/lib/agents/api-auth"
import { containsSecretValue, isTargetType, RWA_COMMERCIAL } from "@/lib/agents/rwa-research"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: Request) {
  const auth = await requireAgentApiKey(req)
  if (!auth.ok) return auth.response
  const started = Date.now()

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

  try {
    const run = await executeRwaResearch({
      subject: auth.subject,
      task,
      targetType: isTargetType(body.targetType) ? body.targetType : "contract",
      channel: "api",
      geoTier: readGeoTier(req),
      allowSponsoredNarrative: false,
    })
    await recordAgentCall({
      subject: auth.subject,
      source: "rwa-api",
      tool: "rwa-research",
      status: run.status === "failed" ? "error" : "success",
      latencyMs: Date.now() - started,
      errorCode: run.status === "failed" ? "EXECUTION_FAILED" : undefined,
    })
    return Response.json({ run, commercial: RWA_COMMERCIAL })
  } catch (error) {
    await recordAgentCall({
      subject: auth.subject,
      source: "rwa-api",
      tool: "rwa-research",
      status: "error",
      latencyMs: Date.now() - started,
      errorCode: error instanceof RwaResearchError ? error.code : "EXECUTION_FAILED",
    })
    if (error instanceof RwaResearchError) return jsonError(error.status, error.code, error.message)
    return jsonError(500, "EXECUTION_FAILED", "研究执行失败")
  }
}
