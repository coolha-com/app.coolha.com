import { getCatalogModelBySlug } from "@/lib/ai-gateway/client"
import { isSponsorableModel, SPONSORED_MAX_INPUT_PRICE_PER_MILLION } from "@/lib/ai-gateway/shared"
import { jsonError, rejectHardBlock, requireRwaSubject } from "@/lib/agents/http"
import {
  listConnectedReadTools,
  parseProfileInput,
  RWA_COMMERCIAL,
} from "@/lib/agents/rwa-research"
import { getRwaProfile, saveRwaProfile } from "@/lib/neon/rwa-research"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function sponsoredSlugError(slug: string): Promise<string | null> {
  const model = await getCatalogModelBySlug(slug)
  if (!model || model.gatewayType !== "language" || model.status === "maintenance") {
    return "所选模型不在可用目录中"
  }
  if (
    !isSponsorableModel(model) ||
    model.inputPricePerMillionUsd > SPONSORED_MAX_INPUT_PRICE_PER_MILLION
  ) {
    return "该模型不在平台赞助范围内"
  }
  return null
}

export async function GET() {
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response
  try {
    const profile = await getRwaProfile(auth.subject)
    return Response.json({
      profile,
      tools: listConnectedReadTools(),
      commercial: RWA_COMMERCIAL,
    })
  } catch (error) {
    console.error("[rwa-research] 读取 profile 失败:", error instanceof Error ? error.name : "error")
    return jsonError(500, "PROFILE_READ_FAILED", "读取 Profile 失败")
  }
}

export async function PUT(req: Request) {
  const blocked = rejectHardBlock(req)
  if (blocked) return blocked
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError(400, "INVALID_JSON", "请求体不是合法 JSON")
  }

  const parsed = parseProfileInput(body)
  if ("error" in parsed) return jsonError(400, "INVALID_PROFILE", parsed.error)

  if (parsed.modelMode === "sponsored" && parsed.sponsoredModelSlug) {
    try {
      const modelError = await sponsoredSlugError(parsed.sponsoredModelSlug)
      if (modelError) return jsonError(400, "MODEL_NOT_SPONSORED", modelError)
    } catch (error) {
      console.error("[rwa-research] 校验赞助模型失败:", error instanceof Error ? error.name : "error")
      return jsonError(503, "CATALOG_UNAVAILABLE", "模型目录暂不可用，Profile 没有保存")
    }
  }

  try {
    const profile = await saveRwaProfile(auth.subject, parsed)
    return Response.json({ profile, commercial: RWA_COMMERCIAL })
  } catch (error) {
    console.error("[rwa-research] 保存 profile 失败:", error instanceof Error ? error.name : "error")
    return jsonError(500, "PROFILE_SAVE_FAILED", "保存 Profile 失败")
  }
}
