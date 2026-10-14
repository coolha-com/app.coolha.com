import type { ComputeCapability, ComputeModel, ComputeModelType } from "@/lib/compute/types"
import type { GatewayRawModel } from "./types"

/**
 * AI Gateway 原始模型 → 站内 ComputeModel 归一化。
 *
 * 原则：上游没有的字段一律留空/置 0，绝不臆造价格、延迟或可用性。
 * 延迟（latencyMs）上游不提供，恒为 null；状态由 deprecated_at 推断，
 * 且 dataSource 标记为 provider-reported，UI 必须展示来源。
 */

/** 上游 type → 站内模型类型 */
const TYPE_MAP: Record<string, ComputeModelType> = {
  language: "chat",
  embedding: "embedding",
  image: "image",
  video: "video",
  speech: "audio",
  transcription: "audio",
  reranking: "reranking",
  realtime: "realtime",
  evaluation: "evaluation",
}

/** 供应商标识 → 展示名（其余走兜底首字母大写） */
const PROVIDER_LABELS: Record<string, string> = {
  alibaba: "Alibaba 阿里",
  amazon: "Amazon",
  anthropic: "Anthropic",
  "arcee-ai": "Arcee AI",
  bfl: "Black Forest Labs",
  bytedance: "ByteDance 字节",
  cohere: "Cohere",
  deepseek: "DeepSeek 深度求索",
  fireworks: "Fireworks AI",
  "fish-audio": "Fish Audio",
  google: "Google",
  heygen: "HeyGen",
  inception: "Inception",
  inclusionai: "Inclusion AI",
  "inference-net": "Inference.net",
  klingai: "Kling AI 可灵",
  liquid: "Liquid AI",
  meituan: "Meituan 美团",
  meta: "Meta",
  microsoft: "Microsoft",
  minimax: "MiniMax",
  mistral: "Mistral AI",
  mixedbread: "Mixedbread",
  moonshotai: "Moonshot AI 月之暗面",
  morph: "Morph",
  nvidia: "NVIDIA",
  openai: "OpenAI",
  perplexity: "Perplexity",
  poolside: "Poolside",
  prodia: "Prodia",
  quiverai: "Quiver AI",
  recraft: "Recraft",
  sakana: "Sakana AI",
  scaledown: "ScaleDown",
  spacexai: "xAI",
  stepfun: "StepFun 阶跃星辰",
  tencent: "Tencent 腾讯",
  thinkingmachines: "Thinking Machines",
  topaz: "Topaz Labs",
  voyage: "Voyage AI",
  xai: "xAI",
  xiaomi: "Xiaomi 小米",
  zai: "Z.ai 智谱",
}

/** 生成 URL 友好的站内 slug */
export function toModelSlug(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function toProviderName(ownedBy: string): string {
  const key = ownedBy.toLowerCase()
  if (PROVIDER_LABELS[key]) return PROVIDER_LABELS[key]
  return key
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

/** 上游价格为「每 token USD」字符串，转换为「每百万 token USD」 */
function perMillion(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN
  if (!Number.isFinite(parsed)) return 0
  return Number((parsed * 1_000_000).toFixed(4))
}

function toIsoDate(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const ms = typeof value === "number" ? value * 1000 : Date.parse(value)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString().slice(0, 10)
}

function toArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function detectCapabilities(raw: GatewayRawModel): ComputeCapability[] {
  const tags = toArray(raw.tags)
  const params = toArray(raw.supported_parameters)
  const inputModalities = toArray(raw.modalities?.input)
  const type = raw.type ?? ""
  const capabilities = new Set<ComputeCapability>()

  // 语言类与实时类模型在网关侧均支持流式返回
  if (type === "language" || type === "realtime") capabilities.add("streaming")

  if (
    inputModalities.includes("image") ||
    inputModalities.includes("video") ||
    tags.includes("vision") ||
    tags.includes("video-input")
  ) {
    capabilities.add("vision")
  }

  if (params.includes("tools") || params.includes("tool_choice") || tags.includes("tool-use")) {
    capabilities.add("tools")
    capabilities.add("function-calling")
  }

  if (
    params.includes("response_format") ||
    params.includes("structured_outputs") ||
    tags.includes("structured-output")
  ) {
    capabilities.add("json-mode")
  }

  return [...capabilities]
}

/** 归一化单个模型；数据不可用时返回 null（调用方过滤） */
export function normalizeGatewayModel(raw: GatewayRawModel): ComputeModel | null {
  if (!raw || typeof raw.id !== "string" || raw.id.length === 0) return null

  const modelId = raw.id
  const providerSlug = (raw.owned_by ?? modelId.split("/")[0] ?? "unknown").toLowerCase()
  const gatewayType = raw.type ?? "language"
  const type = TYPE_MAP[gatewayType] ?? "chat"
  const deprecatedAt = toIsoDate(raw.deprecated_at)
  const pricing = raw.pricing ?? {}

  return {
    id: toModelSlug(modelId),
    name: raw.name ?? modelId,
    modelId,
    // 真实目录：条目本身就是网关可调用的模型 ID
    gatewayModelId: modelId,
    providerId: providerSlug,
    providerName: toProviderName(providerSlug),
    type,
    summary: raw.description ?? "上游暂未提供描述。",
    capabilities: detectCapabilities(raw),
    contextLength: typeof raw.context_window === "number" ? raw.context_window : 0,
    maxOutputTokens: typeof raw.max_tokens === "number" ? raw.max_tokens : 0,
    inputPricePerMillionUsd: perMillion(pricing.input),
    outputPricePerMillionUsd: perMillion(pricing.output),
    // 上游不提供延迟数据，保持未知，不臆造
    latencyMs: null,
    status: deprecatedAt ? "maintenance" : "online",
    dataSource: "provider-reported",
    updatedAt: toIsoDate(raw.released ?? raw.created) ?? new Date().toISOString().slice(0, 10),

    gatewayType,
    providerSlug,
    modalities: {
      input: toArray(raw.modalities?.input),
      output: toArray(raw.modalities?.output),
    },
    tags: toArray(raw.tags),
    supportedParameters: toArray(raw.supported_parameters),
    knowledge: typeof raw.knowledge === "string" ? raw.knowledge : undefined,
    regions: toArray(raw.regions),
    zeroDataRetention: raw.zdr ?? null,
    noTraining: raw.no_training ?? null,
    releasedAt: toIsoDate(raw.released) ?? undefined,
    deprecatedAt,
    cachedInputPricePerMillionUsd:
      typeof pricing.input_cache_read === "string" ? perMillion(pricing.input_cache_read) : null,
    priceVariesByProvider: pricing.varies_by_provider === true,
  }
}
