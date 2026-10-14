/**
 * 算力市场（Compute Market）核心类型定义。
 * Phase 1 仅使用 Mock 目录；Phase 2 起 modelId/gatewayModelId 对应 Vercel AI Gateway 真实模型。
 */

/** 模型类型（Phase 2 起对齐 AI Gateway 上游 type） */
export type ComputeModelType =
  | "chat"
  | "reasoning"
  | "code"
  | "vision"
  | "embedding"
  | "image"
  | "video"
  | "audio"
  | "reranking"
  | "realtime"
  | "evaluation"

/** 服务状态 */
export type ComputeServiceStatus = "online" | "degraded" | "maintenance" | "unknown"

/**
 * 数据来源标识。
 * mock = 演示数据（Phase 1 唯一来源）
 * provider-reported = 供应商报告数据
 * realtime = 平台实时探测数据
 */
export type ComputeDataSource = "mock" | "provider-reported" | "realtime"

/** 模型能力标签 */
export type ComputeCapability =
  | "streaming"
  | "vision"
  | "tools"
  | "json-mode"
  | "function-calling"

export interface ComputeProvider {
  id: string
  name: string
  /** 该供应商目录条目的数据来源；Phase 1 恒为 mock */
  dataSource: ComputeDataSource
}

export interface ComputeModel {
  /** 站内 slug，用于 /ai/models/[id] */
  id: string
  name: string
  /** 统一展示的模型 ID（Phase 2 起对应 AI Gateway 模型 ID） */
  modelId: string
  /** AI Gateway 模型 ID；Mock 目录下恒为 null */
  gatewayModelId: string | null
  providerId: string
  providerName: string
  type: ComputeModelType
  summary: string
  capabilities: ComputeCapability[]
  /** 上下文窗口（tokens） */
  contextLength: number
  /** 最大输出（tokens）；嵌入类模型为 0 */
  maxOutputTokens: number
  /** 输入价格（USD / 百万 tokens） */
  inputPricePerMillionUsd: number
  /** 输出价格（USD / 百万 tokens）；嵌入类或不适用时为 0 */
  outputPricePerMillionUsd: number
  /** 实测或供应商报告的延迟（ms）；未知为 null */
  latencyMs: number | null
  status: ComputeServiceStatus
  dataSource: ComputeDataSource
  /** 数据更新时间（ISO 日期） */
  updatedAt: string

  /* ---------- 以下为 AI Gateway 真实目录附加字段（演示目录为空） ---------- */

  /** 上游原始 type：language / embedding / image / video / speech / transcription / reranking / realtime / evaluation */
  gatewayType?: string
  /** 上游 owned_by 原始标识，如 anthropic */
  providerSlug?: string
  /** 支持的输入输出模态 */
  modalities?: { input: string[]; output: string[] }
  /** 上游标签：reasoning / tool-use / vision / web-search ... */
  tags?: string[]
  /** 上游支持的请求参数 */
  supportedParameters?: string[]
  /** 知识截止（YYYY-MM） */
  knowledge?: string
  /** 可用区域，如 ["us", "eu"] */
  regions?: string[]
  /** 零数据保留策略：all / some / none */
  zeroDataRetention?: string | null
  /** 上游承诺不用于训练：all / some / none */
  noTraining?: string | null
  /** 发布日期（ISO 日期） */
  releasedAt?: string
  /** 废弃日期（ISO 日期）；存在则该模型已下线 */
  deprecatedAt?: string | null
  /** 缓存命中输入价格（USD / 百万 tokens） */
  cachedInputPricePerMillionUsd?: number | null
  /** 价格是否随下游供应商浮动 */
  priceVariesByProvider?: boolean
}

/** 模型查询参数（全部可选） */
export interface ModelQuery {
  search?: string
  type?: ComputeModelType | "all"
  providerId?: string | "all"
  capability?: ComputeCapability | "all"
  /** 输入价格上限（USD / 百万 tokens） */
  maxInputPricePerMillion?: number | null
  sort?: ModelSort
}

export type ModelSort =
  | "name-asc"
  | "price-asc"
  | "price-desc"
  | "output-price-asc"
  | "output-price-desc"
  | "context-desc"
  | "context-asc"
  | "latency-asc"

/** 成本估算结果 */
export interface UsageEstimate {
  inputTokens: number
  outputTokens: number
  inputCostUsd: number
  outputCostUsd: number
  totalCostUsd: number
}

/** Playground Mock 响应回传的调用元数据（transient data part） */
export interface ComputePlaygroundMeta {
  requestId: string
  /** mock = 演示回复；live = 真实 AI Gateway 调用 */
  mode: "mock" | "live"
  modelId: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  costUsd: number
  latencyMs: number
  /** true = 本地按目录单价估算；false = 上游回传的真实成本 */
  estimated: boolean
  /** 上游 generation id（真实调用） */
  generationId?: string
  /** 上游实际承接的供应商（真实调用） */
  resolvedProvider?: string
}
