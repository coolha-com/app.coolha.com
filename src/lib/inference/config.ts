/**
 * 统一推理网关配置（唯一真相源）。
 *
 * 背景：Vercel AI Gateway 团队被永久停用（疑似滥用，无申诉通道），全站不再依赖它。
 * Coolha 现在只对接**一个** OpenAI 兼容推理网关：eve Runtime、narrate
 * narrate 都从这份配置取端点、密钥与模型白名单。换厂商只改环境变量，不改代码。
 *
 * 合规口径（AaaS）：按 Agent 服务计费，不按 token 分档，不转售模型额度。
 * 未配置时一律 fail-closed（如实返回「未接入」），绝不伪造成功或返回占位数值。
 */

/** 厂商 / 聚合网关的 OpenAI 兼容根地址，例如 https://openrouter.ai/api/v1 */
export const INFERENCE_BASE_URL = process.env.INFERENCE_BASE_URL ?? ""

/** 该网关的密钥；服务端专用，永不下行浏览器 */
export const INFERENCE_API_KEY = process.env.INFERENCE_API_KEY ?? ""

/** 网关展示名，仅供 UI / 日志标注，不参与请求 */
export const INFERENCE_GATEWAY_NAME =
  process.env.INFERENCE_GATEWAY_NAME ?? "推理网关"

/** 默认模型 ID（厂商原生 ID，不是 Vercel 的 provider/model 格式） */
export const INFERENCE_DEFAULT_MODEL =
  process.env.INFERENCE_DEFAULT_MODEL ?? ""

/**
 * 允许使用的模型 ID 列表（逗号分隔）。
 * 这是服务端白名单，前端只能从里面选，代理再校验一次。
 * 例：INFERENCE_MODELS=deepseek-chat,gpt-4o-mini,claude-3-5-haiku
 */
export function inferenceModelIds(): string[] {
  const raw = process.env.INFERENCE_MODELS ?? ""
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

/** 网关是否已完成最小配置 */
export function isInferenceConfigured(): boolean {
  return Boolean(INFERENCE_BASE_URL && INFERENCE_API_KEY)
}

/** 推理是否真的可用：端点 + 密钥 + 至少一个可选模型 */
export function isInferenceReady(): boolean {
  return isInferenceConfigured() && inferenceModelIds().length > 0
}

/** 把前端传入的模型 ID 收敛到白名单；无白名单时返回 null（不猜） */
export function resolveInferenceModel(requested: string | null | undefined): string | null {
  const ids = inferenceModelIds()
  if (ids.length === 0) return null
  if (requested && ids.includes(requested)) return requested
  const preferred = INFERENCE_DEFAULT_MODEL
  if (preferred && ids.includes(preferred)) return preferred
  return ids[0]
}

/**
 * 未配置时的统一错误体，供各路由复用。
 * message 明确说明「未接入」，不暗示稍后会自动恢复。
 */
export const INFERENCE_NOT_CONFIGURED = {
  code: "INFERENCE_NOT_CONFIGURED",
  message: "推理网关未接入：请配置 INFERENCE_BASE_URL / INFERENCE_API_KEY / INFERENCE_MODELS",
} as const
