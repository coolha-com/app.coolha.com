import { createOpenAICompatible } from "@ai-sdk/openai-compatible"

import { resolveInferenceModel } from "@/lib/inference/config"

/**
 * 平台推理凭据。
 *
 * BYOK（"byok"）只保留类型，本次不实现：
 * 用户密钥不得写入 chat_sessions、agent 事件或浏览器日志，也不得覆盖服务端白名单。
 * 现在所有调用都用平台的 INFERENCE_API_KEY。
 */
export type InferenceCredentialSource = "platform" | "byok"

export interface PlatformInferenceCredential {
  source: "platform"
  baseURL: string
  apiKey: string
  gatewayName: string
}

export function platformInferenceCredential(
  env: NodeJS.ProcessEnv = process.env,
): PlatformInferenceCredential {
  return {
    source: "platform",
    baseURL: env.INFERENCE_BASE_URL ?? "",
    apiKey: env.INFERENCE_API_KEY ?? "",
    gatewayName: env.INFERENCE_GATEWAY_NAME ?? "OpenRouter",
  }
}

/** OpenRouter 应用识别头。其他网关不附带，避免把厂商头发给错误的上游。 */
export function openRouterAppHeaders(baseURL: string): Record<string, string> | undefined {
  try {
    if (new URL(baseURL).host === "openrouter.ai") {
      return {
        "HTTP-Referer": "https://app.coolha.com",
        "X-OpenRouter-Title": "Coolha",
      }
    }
  } catch {
    return undefined
  }
  return undefined
}

/**
 * 给不走 EVE 持久化生命周期的独立生成用。
 * 模型 ID 必须先过白名单；未授权模型直接抛错，不回落到默认模型。
 */
export function createPlatformLanguageModel(requested: string | null | undefined) {
  const resolved = resolveInferenceModel(requested)
  if (!resolved.ok) {
    throw new Error(
      resolved.reason === "not_allowed" ? "MODEL_NOT_ALLOWED" : "INFERENCE_NOT_CONFIGURED",
    )
  }
  const credential = platformInferenceCredential()
  const provider = createOpenAICompatible({
    name: credential.gatewayName,
    baseURL: credential.baseURL,
    apiKey: credential.apiKey,
    headers: openRouterAppHeaders(credential.baseURL),
    includeUsage: true,
  })
  return provider(resolved.modelId)
}
