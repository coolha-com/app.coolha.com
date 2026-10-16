import { RESEARCH_DIMENSIONS } from "@/lib/research/dimensions"
import { generateResearchReport } from "@/lib/research/engine"
import type { DimensionId, TargetType } from "@/lib/research/types"

export const dynamic = "force-dynamic"
// Alchemy 密钥只在服务端读取（process.env），必须跑在 Node runtime
export const runtime = "nodejs"

const VALID_DIMENSIONS = new Set<string>(RESEARCH_DIMENSIONS.map((d) => d.id))
const VALID_TYPES = new Set<string>(["contract", "token", "project"])

interface ResearchRequestBody {
  target?: unknown
  targetType?: unknown
  dimensions?: unknown
}

/**
 * 投前侦察（真实数据驱动）。
 *
 * 服务端执行的原因：Alchemy 密钥不能下发到浏览器。
 * 拿不到数据的维度会返回 status=unavailable，前端据此不渲染任何数值。
 */
export async function POST(request: Request) {
  let body: ResearchRequestBody
  try {
    body = (await request.json()) as ResearchRequestBody
  } catch {
    return Response.json({ error: "请求体不是合法 JSON" }, { status: 400 })
  }

  const target = typeof body.target === "string" ? body.target.trim() : ""
  if (target.length < 2 || target.length > 200) {
    return Response.json({ error: "侦察目标长度需在 2–200 字符之间" }, { status: 400 })
  }

  const targetType: TargetType =
    typeof body.targetType === "string" && VALID_TYPES.has(body.targetType)
      ? (body.targetType as TargetType)
      : "contract"

  const dimensions: DimensionId[] = Array.isArray(body.dimensions)
    ? (body.dimensions.filter(
        (d): d is DimensionId => typeof d === "string" && VALID_DIMENSIONS.has(d),
      ) as DimensionId[])
    : []

  try {
    const report = await generateResearchReport(target, dimensions, targetType)
    return Response.json({ report })
  } catch {
    // 不泄露内部错误细节
    return Response.json({ error: "侦察失败，请稍后重试" }, { status: 500 })
  }
}
