/**
 * Vercel AI Gateway 模型目录（OpenAI 兼容 /v1/models）原始响应类型。
 *
 * 仅描述上游返回的字段，不做任何业务语义映射；映射逻辑见 ./normalize.ts。
 * 上游字段可能随版本增删，未知字段一律忽略，避免解析时抛错。
 */

export interface GatewayRawPricing {
  /** 单 token 输入价格（USD，字符串小数） */
  input?: string
  output?: string
  input_cache_read?: string
  input_cache_write?: string
  web_search?: string
  image?: string
  /** 同一模型在不同下游供应商间价格是否浮动 */
  varies_by_provider?: boolean
  [key: string]: unknown
}

export interface GatewayRawModality {
  input?: string[]
  output?: string[]
}

export interface GatewayRawModel {
  /** 统一模型 ID，形如 anthropic/claude-sonnet-4.5 */
  id: string
  object?: string
  /** 上游收录时间（Unix 秒） */
  created?: number
  /** 模型发布日期（Unix 秒） */
  released?: number
  /** 供应商标识，形如 anthropic */
  owned_by?: string
  name?: string
  description?: string
  context_window?: number | null
  max_tokens?: number | null
  /** language / embedding / image / video / speech / transcription / reranking / realtime / evaluation */
  type?: string
  /** 零数据保留：all / some / none */
  zdr?: string | null
  /** 承诺不用于训练：all / some / none */
  no_training?: string | null
  tags?: string[]
  supported_specifications?: string[]
  supported_parameters?: string[]
  temperature?: boolean
  modalities?: GatewayRawModality
  /** 知识截止，形如 2025-04 */
  knowledge?: string
  regions?: string[]
  pricing?: GatewayRawPricing
  deprecated_at?: number | string | null
  [key: string]: unknown
}

export interface GatewayModelsResponse {
  object?: string
  data?: GatewayRawModel[]
}
