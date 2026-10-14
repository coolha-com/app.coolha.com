import { neon } from "@neon/ai-sdk-provider"

/**
 * Neon AI Gateway（AI SDK Provider）。
 * 零配置读取 NEON_AI_GATEWAY_TOKEN / NEON_AI_GATEWAY_BASE_URL；
 * 未启用网关时返回 null，路由层据此返回 503。
 */

export function isAiGatewayConfigured(): boolean {
  return Boolean(process.env.NEON_AI_GATEWAY_TOKEN && process.env.NEON_AI_GATEWAY_BASE_URL)
}

/** 默认模型可用 NEON_AI_GATEWAY_MODEL 覆盖 */
export const DEFAULT_GATEWAY_MODEL = process.env.NEON_AI_GATEWAY_MODEL || "claude-haiku-4-5"

export function getGatewayModel(modelId?: string) {
  if (!isAiGatewayConfigured()) return null
  return neon(modelId || DEFAULT_GATEWAY_MODEL)
}

/** 运行时发现分支当前可用的模型目录（OpenAI 兼容 /v1/models） */
export async function discoverGatewayModel(): Promise<string | null> {
  const base = process.env.NEON_AI_GATEWAY_BASE_URL
  const token = process.env.NEON_AI_GATEWAY_TOKEN
  if (!base || !token) return null
  try {
    const response = await fetch(`${base}/v1/models`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return null
    const json = (await response.json()) as {
      data?: Array<{ id?: string; enabled?: boolean }>
    }
    const first = json.data?.find((model) => model.enabled !== false && model.id)
    return first?.id ?? null
  } catch {
    return null
  }
}
