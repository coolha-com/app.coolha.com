import { DEMO_MODELS } from "./catalog"
import type {
  ComputeCapability,
  ComputeModel,
  ComputeModelType,
  ComputeProvider,
  ModelQuery,
  ModelSort,
  UsageEstimate,
} from "./types"

/**
 * 算力市场数据访问层（Phase 1：Mock 目录）。
 * UI 组件禁止直接 import catalog，一律经过本 service。
 * 本文件为同构纯函数，服务端与客户端均可安全引用（不含任何服务端专有 API）。
 */

export const MODEL_TYPE_LABELS: Record<ComputeModelType, string> = {
  chat: "对话",
  reasoning: "推理",
  code: "代码",
  vision: "视觉理解",
  embedding: "嵌入",
  image: "图像生成",
  video: "视频生成",
  audio: "语音",
  reranking: "重排序",
  realtime: "实时",
  evaluation: "评测",
}

export const CAPABILITY_LABELS: Record<ComputeCapability, string> = {
  streaming: "流式输出",
  vision: "视觉输入",
  tools: "工具调用",
  "json-mode": "JSON 模式",
  "function-calling": "函数调用",
}

export const SERVICE_STATUS_LABELS: Record<ComputeModel["status"], string> = {
  online: "在线",
  degraded: "性能下降",
  maintenance: "维护中",
  unknown: "未知",
}

export const SORT_LABELS: Record<ModelSort, string> = {
  "name-asc": "名称",
  "price-asc": "输入价格（从低到高）",
  "price-desc": "输入价格（从高到低）",
  "output-price-asc": "输出价格（从低到高）",
  "output-price-desc": "输出价格（从高到低）",
  "latency-asc": "延迟（从低到高）",
  "context-desc": "上下文长度（从长到短）",
  "context-asc": "上下文长度（从短到长）",
}

/** 可点击表头排序的列 → 该列支持的两个方向（首次点击用第一个） */
export const COLUMN_SORTS = {
  context: ["context-desc", "context-asc"],
  inputPrice: ["price-asc", "price-desc"],
  outputPrice: ["output-price-asc", "output-price-desc"],
} as const satisfies Record<string, readonly [ModelSort, ModelSort]>

export type SortableColumn = keyof typeof COLUMN_SORTS

/** 点击表头：未激活则取该列首选方向，已激活则在两个方向间切换 */
export function nextSortForColumn(column: SortableColumn, current: ModelSort): ModelSort {
  const [first, second] = COLUMN_SORTS[column]
  return current === first ? second : first
}

/** 数据来源标识的中文说明，UI 必须随数据一同展示 */
export const DATA_SOURCE_NOTICE: Record<ComputeModel["dataSource"], string> = {
  mock: "示例数据（非真实供应商报价）",
  "provider-reported": "供应商报告数据",
  realtime: "平台实时探测数据",
}

export function listModels(query: ModelQuery = {}): ComputeModel[] {
  return filterModels(DEMO_MODELS, query)
}

/** 对任意模型列表执行排序（不改动入参） */
export function sortModels(models: ComputeModel[], sort: ModelSort = "name-asc"): ComputeModel[] {
  const result = [...models]
  switch (sort) {
    case "price-asc":
      result.sort((a, b) => a.inputPricePerMillionUsd - b.inputPricePerMillionUsd)
      break
    case "price-desc":
      result.sort((a, b) => b.inputPricePerMillionUsd - a.inputPricePerMillionUsd)
      break
    case "output-price-asc":
      result.sort((a, b) => a.outputPricePerMillionUsd - b.outputPricePerMillionUsd)
      break
    case "output-price-desc":
      result.sort((a, b) => b.outputPricePerMillionUsd - a.outputPricePerMillionUsd)
      break
    case "latency-asc":
      result.sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity))
      break
    case "context-desc":
      result.sort((a, b) => b.contextLength - a.contextLength)
      break
    case "context-asc":
      result.sort((a, b) => a.contextLength - b.contextLength)
      break
    default:
      result.sort((a, b) => a.name.localeCompare(b.name))
  }
  return result
}

/**
 * 对任意来源的模型列表执行筛选 + 排序（不改动入参）。
 * Phase 2 真实目录与 Phase 1 演示目录共用同一套筛选语义。
 */
export function filterModels(models: ComputeModel[], query: ModelQuery = {}): ComputeModel[] {
  let result = [...models]

  const keyword = query.search?.trim().toLowerCase()
  if (keyword) {
    result = result.filter(
      (model) =>
        model.name.toLowerCase().includes(keyword) ||
        model.modelId.toLowerCase().includes(keyword) ||
        model.providerName.toLowerCase().includes(keyword) ||
        model.summary.toLowerCase().includes(keyword),
    )
  }

  if (query.type && query.type !== "all") {
    result = result.filter((model) => model.type === query.type)
  }

  if (query.providerId && query.providerId !== "all") {
    result = result.filter((model) => model.providerId === query.providerId)
  }

  const capability = query.capability
  if (capability && capability !== "all") {
    result = result.filter((model) => model.capabilities.includes(capability))
  }

  const maxInputPrice = query.maxInputPricePerMillion
  if (typeof maxInputPrice === "number") {
    result = result.filter((model) => model.inputPricePerMillionUsd <= maxInputPrice)
  }

  return sortModels(result, query.sort)
}

/** 从模型列表反推供应商列表（按名称排序） */
export function deriveProviders(models: ComputeModel[]): ComputeProvider[] {
  const map = new Map<string, ComputeProvider>()
  for (const model of models) {
    if (map.has(model.providerId)) continue
    map.set(model.providerId, {
      id: model.providerId,
      name: model.providerName,
      dataSource: model.dataSource,
    })
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function getModelById(id: string): ComputeModel | null {
  return DEMO_MODELS.find((model) => model.id === id) ?? null
}

export function listProviders(): ComputeProvider[] {
  return deriveProviders(DEMO_MODELS)
}

/** Playground 可选模型：演示目录中状态可用的对话/推理/代码/视觉类模型 */
export function listPlaygroundModels(): ComputeModel[] {
  // 保留给演示目录回退场景；真实目录路径见 src/lib/ai-gateway/playground.ts
  return DEMO_MODELS.filter((model) => model.type !== "embedding")
}

export function estimateCost(
  model: Pick<ComputeModel, "inputPricePerMillionUsd" | "outputPricePerMillionUsd">,
  inputTokens: number,
  outputTokens: number,
): UsageEstimate {
  const safeInput = Number.isFinite(inputTokens) && inputTokens > 0 ? inputTokens : 0
  const safeOutput = Number.isFinite(outputTokens) && outputTokens > 0 ? outputTokens : 0
  const inputCostUsd = (safeInput / 1_000_000) * model.inputPricePerMillionUsd
  const outputCostUsd = (safeOutput / 1_000_000) * model.outputPricePerMillionUsd
  return {
    inputTokens: safeInput,
    outputTokens: safeOutput,
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
  }
}

/** 金额格式化：小额保留 6 位小数，与 PRD 成本估算器示例保持一致 */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "$0.00"
  if (value < 0.01) return `$${value.toFixed(6)}`
  if (value < 1) return `$${value.toFixed(4)}`
  return `$${value.toFixed(2)}`
}

/** 每百万 token 单价格式化：0 / 未知显示为破折号，避免把免费与未公布混为一谈 */
export function formatPricePerMillion(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—"
  if (value < 0.01) return `$${value.toFixed(4)}/M`
  return `$${value.toFixed(2)}/M`
}

export function formatTokens(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return String(value)
}

export function formatLatency(ms: number | null): string {
  if (ms === null) return "未知"
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms}ms`
}
