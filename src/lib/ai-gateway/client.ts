import { DEMO_MODELS } from "@/lib/compute/catalog"
import { deriveProviders } from "@/lib/compute/service"
import type { ComputeModel, ComputeProvider } from "@/lib/compute/types"
import { normalizeGatewayModel } from "./normalize"
import type { GatewayModelsResponse, GatewayRawModel } from "./types"

/**
 * Vercel AI Gateway 模型目录拉取层（仅服务端调用）。
 *
 * 数据来自 AI Gateway 的 OpenAI 兼容端点 GET {base}/v1/models，
 * 需要服务端环境变量 AI_GATEWAY_API_KEY。该 Key 只在服务端使用，绝不下发到浏览器。
 *
 * 缓存策略：默认复用 Next.js Data Cache 1 小时（next.revalidate），
 * 单次请求内用 React cache 去重；?refresh=1 时强制回源。
 */

export const AI_GATEWAY_BASE_URL =
  process.env.AI_GATEWAY_BASE_URL ?? "https://ai-gateway.vercel.sh/v1"

/** 目录缓存时长（秒） */
export const CATALOG_REVALIDATE_SECONDS = 3600

export const CATALOG_CACHE_TAG = "ai-gateway-models"

export function isAiGatewayConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY)
}

export type CatalogSource = "ai-gateway" | "demo"

export interface ModelCatalog {
  models: ComputeModel[]
  providers: ComputeProvider[]
  source: CatalogSource
  /** 目录快照时间（ISO） */
  fetchedAt: string
  /** true = 上游不可用，当前展示的是 Phase 1 演示目录 */
  stale: boolean
  /** 上游失败原因（仅服务端日志/接口 debug，不直接面向终端用户） */
  error?: string
}

function demoCatalog(error?: string): ModelCatalog {
  return {
    models: DEMO_MODELS,
    providers: deriveProviders(DEMO_MODELS),
    source: "demo",
    fetchedAt: new Date().toISOString(),
    stale: Boolean(error),
    error,
  }
}

/** 拉取上游原始模型列表；失败时抛出带状态的错误 */
async function requestGatewayModels(force: boolean): Promise<GatewayRawModel[]> {
  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey) throw new Error("AI_GATEWAY_API_KEY_NOT_SET")

  const response = await fetch(`${AI_GATEWAY_BASE_URL}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    ...(force
      ? { cache: "no-store" as const }
      : { next: { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_CACHE_TAG] } }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`UPSTREAM_${response.status}`)
  }

  const json = (await response.json()) as GatewayModelsResponse
  const raw = Array.isArray(json?.data) ? json.data : []
  if (raw.length === 0) throw new Error("UPSTREAM_EMPTY")
  return raw
}

/**
 * 获取模型目录（归一化后）。
 * 上游不可用或未配置 Key 时降级为演示目录，并在 stale/error 中标记，
 * 保证页面永远有内容、且不会把演示数据伪装成真实数据。
 */
export async function getModelCatalog(options?: { force?: boolean }): Promise<ModelCatalog> {
  if (!isAiGatewayConfigured()) {
    return demoCatalog("AI_GATEWAY_API_KEY_NOT_SET")
  }

  try {
    const raw = await requestGatewayModels(Boolean(options?.force))
    // slug 由模型 ID 推导，理论上唯一；出现重名时追加序号，保证 /ai/models/[id] 可寻址
    const slugCount = new Map<string, number>()
    const models = raw
      .map((item) => normalizeGatewayModel(item))
      .filter((model): model is ComputeModel => model !== null)
      .map((model) => {
        const seen = slugCount.get(model.id) ?? 0
        slugCount.set(model.id, seen + 1)
        return seen === 0 ? model : { ...model, id: `${model.id}-${seen + 1}` }
      })

    if (models.length === 0) {
      return demoCatalog("UPSTREAM_EMPTY")
    }

    return {
      models,
      providers: deriveProviders(models),
      source: "ai-gateway",
      fetchedAt: new Date().toISOString(),
      stale: false,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR"
    console.error("[ai-gateway] 拉取模型目录失败:", message)
    return demoCatalog(message)
  }
}

/** 列表卡片摘要最大长度：描述原文可达数百字符，首屏只保留可预览部分 */
const LIST_SUMMARY_MAX_LENGTH = 180

/**
 * 列表页载荷瘦身：只保留卡片渲染与筛选所需字段。
 * 464 个模型的全量字段会让首屏 RSC 载荷膨胀到数百 KB，
 * 规格类字段（模态/区域/标签等）只在详情页按需读取。
 */
export function toListModel(model: ComputeModel): ComputeModel {
  const summary =
    model.summary.length > LIST_SUMMARY_MAX_LENGTH
      ? `${model.summary.slice(0, LIST_SUMMARY_MAX_LENGTH)}…`
      : model.summary

  return {
    id: model.id,
    name: model.name,
    modelId: model.modelId,
    gatewayModelId: model.gatewayModelId,
    providerId: model.providerId,
    providerName: model.providerName,
    type: model.type,
    summary,
    capabilities: model.capabilities,
    contextLength: model.contextLength,
    maxOutputTokens: model.maxOutputTokens,
    inputPricePerMillionUsd: model.inputPricePerMillionUsd,
    outputPricePerMillionUsd: model.outputPricePerMillionUsd,
    latencyMs: model.latencyMs,
    status: model.status,
    dataSource: model.dataSource,
    updatedAt: model.updatedAt,
    // 能力标签用于列表的图标化展示，体积很小（平均 3 个短标签）
    tags: model.tags,
  }
}

/** 按站内 slug 查找模型（slug 由 normalize.ts 生成） */
export async function getCatalogModelBySlug(slug: string): Promise<ComputeModel | null> {
  const catalog = await getModelCatalog()
  return catalog.models.find((model) => model.id === slug) ?? null
}
