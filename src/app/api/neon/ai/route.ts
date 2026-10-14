import { generateText } from "ai"
import {
  discoverGatewayModel,
  getGatewayModel,
  isAiGatewayConfigured,
} from "@/lib/neon/ai-gateway"

export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Neon AI Gateway 连通性验证路由。
 * POST { "prompt": "...", "model": "可选" } → 真实模型补全。
 * model 缺省时运行时发现分支目录中第一个可用模型。
 */

function jsonError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status })
}

export async function POST(req: Request) {
  if (!isAiGatewayConfigured()) {
    return jsonError(
      503,
      "AI_GATEWAY_NOT_CONFIGURED",
      "Neon AI Gateway 未配置（缺少 NEON_AI_GATEWAY_TOKEN / NEON_AI_GATEWAY_BASE_URL）",
    )
  }

  let body: { prompt?: unknown; model?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonError(400, "INVALID_JSON", "请求体不是合法 JSON")
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
  if (!prompt) {
    return jsonError(400, "EMPTY_PROMPT", "请提供 prompt")
  }

  const modelId =
    typeof body.model === "string" && body.model.trim() ? body.model.trim() : await discoverGatewayModel()
  if (!modelId) {
    return jsonError(503, "NO_MODEL_AVAILABLE", "分支模型目录中暂无可用模型")
  }

  const model = getGatewayModel(modelId)
  if (!model) {
    return jsonError(503, "AI_GATEWAY_NOT_CONFIGURED", "AI Gateway 客户端创建失败")
  }

  const startedAt = Date.now()
  try {
    const result = await generateText({ model, prompt })
    return Response.json({
      ok: true,
      model: modelId,
      text: result.text,
      usage: result.usage,
      latencyMs: Date.now() - startedAt,
    })
  } catch (error) {
    return jsonError(
      502,
      "AI_GATEWAY_CALL_FAILED",
      error instanceof Error ? error.message : "unknown error",
    )
  }
}

export async function GET() {
  return jsonError(405, "METHOD_NOT_ALLOWED", "请使用 POST， Body: { prompt, model? }")
}
