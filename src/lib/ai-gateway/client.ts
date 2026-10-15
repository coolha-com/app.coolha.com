import "server-only"

import { revalidateTag } from "next/cache"
import { DEMO_MODELS } from "@/lib/compute/catalog"
import { isDatabaseConfigured } from "@/lib/neon/postgres"
import { deriveProviders } from "@/lib/compute/service"
import type { ComputeModel, ComputeProvider } from "@/lib/compute/types"
import {
  CATALOG_CACHE_TAG,
  CATALOG_REVALIDATE_SECONDS,
} from "@/lib/ai-gateway/shared"
import {
  claimCatalogSync,
  readCachedCatalogSnapshot,
  readCatalogModelById,
  releaseCatalogSync,
  writeCatalogSnapshot,
} from "@/lib/neon/model-catalog"
import { normalizeGatewayModel } from "./normalize"
import type { GatewayModelsResponse, GatewayRawModel } from "./types"

/**
 * Vercel AI Gateway 模型目录读取层（仅服务端调用）。
 *
 * 数据链路：上游 AI Gateway → Neon（model_catalog 表）→ 页面 / 公开 API。
 * 读请求只查自有数据库，不回源上游；上游调用频率由「按流量」降为「按 TTL」，
 * 大幅降低上游限额消耗，且数据持久可审计。
 *
 * 同步时机：快照缺失或超过 CATALOG_REVALIDATE_SECONDS 时惰性同步，
 * 由数据库认领锁保证同一时间窗口内最多一个实例回源；上游失败时继续使用
 * 陈旧快照（stale=true），绝不把演示数据伪装成实时数据。
 *
 * 数据库未接线时回退到 Next.js Data Cache 策略（保持原行为）。
 */

export const AI_GATEWAY_BASE_URL =
  process.env.AI_GATEWAY_BASE_URL ?? "https://ai-gateway.vercel.sh/v1"

/** 目录快照有效期（秒）：到期后才允许回源上游（定义在 shared，供客户端安全引用） */
export { CATALOG_REVALIDATE_SECONDS, CATALOG_CACHE_TAG }

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

/** 拉取上游原始模型列表；失败时抛出带状态的错误。同步路径一律 no-store（快照新鲜度由库保证） */
async function requestGatewayModels(): Promise<GatewayRawModel[]> {
  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey) throw new Error("AI_GATEWAY_API_KEY_NOT_SET")

  const response = await fetch(`${AI_GATEWAY_BASE_URL}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
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

/** 上游原始列表 → 归一化模型（slug 去重，保证 /ai/models/[id] 可寻址） */
function normalizeCatalog(raw: GatewayRawModel[]): ComputeModel[] {
  const slugCount = new Map<string, number>()
  return raw
    .map((item) => normalizeGatewayModel(item))
    .filter((model): model is ComputeModel => model !== null)
    .map((model) => {
      const seen = slugCount.get(model.id) ?? 0
      slugCount.set(model.id, seen + 1)
      return seen === 0 ? model : { ...model, id: `${model.id}-${seen + 1}` }
    })
}

/**
 * 获取模型目录：数据库快照优先。
 * force = true 时强制回源上游并刷新快照（供 /api/v1/models?refresh=1 使用）。
 */
export async function getModelCatalog(options?: { force?: boolean }): Promise<ModelCatalog> {
  const force = Boolean(options?.force)

  // 1) 读库（经 Data Cache：一次 TTL 内只读库一次，避免高频请求反复拉取全量目录）
  const snapshot = await readCachedCatalogSnapshot()
  const ageMs = snapshot ? Date.now() - new Date(snapshot.syncedAt).getTime() : Number.POSITIVE_INFINITY
  const isFresh = Boolean(snapshot) && ageMs < CATALOG_REVALIDATE_SECONDS * 1000

  if (snapshot && isFresh && !force) {
    return {
      models: snapshot.models,
      providers: snapshot.providers,
      source: snapshot.source,
      fetchedAt: snapshot.syncedAt,
      stale: false,
    }
  }

  if (!isAiGatewayConfigured()) {
    // 未配置 Key：有快照就用快照（标注陈旧），否则演示目录
    return snapshot ? toStaleCatalog(snapshot.models, snapshot.providers, "AI_GATEWAY_API_KEY_NOT_SET", snapshot.syncedAt) : demoCatalog("AI_GATEWAY_API_KEY_NOT_SET")
  }

  // 2) 快照缺失或过期：认领同步权（并发实例直接用现有快照，不重复回源）
  const claimed = await claimCatalogSync()
  if (!claimed) {
    return snapshot
      ? toStaleCatalog(snapshot.models, snapshot.providers, "SYNC_IN_PROGRESS", snapshot.syncedAt)
      : demoCatalog("SYNC_IN_PROGRESS")
  }

  try {
    const raw = await requestGatewayModels()
    const models = normalizeCatalog(raw)
    if (models.length === 0) throw new Error("UPSTREAM_EMPTY")

    await writeCatalogSnapshot(models)
    await releaseCatalogSync(true, { count: models.length })
    // 同步成功后让 Data Cache 失效，下一次读直接拿新快照（profile: max = 标记过期后按需后台重算）
    revalidateTag(CATALOG_CACHE_TAG, "max")

    return {
      models,
      providers: deriveProviders(models),
      source: "ai-gateway",
      fetchedAt: new Date().toISOString(),
      stale: false,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR"
    console.error("[ai-gateway] 同步模型目录失败:", message)
    await releaseCatalogSync(false, { error: message }).catch(() => {})

    // 兜底优先级：陈旧快照 > 演示目录
    return snapshot
      ? toStaleCatalog(snapshot.models, snapshot.providers, message, snapshot.syncedAt)
      : demoCatalog(message)
  }
}

/** 用陈旧快照构造返回值：数据真实但已过期，stale 标记为 true */
function toStaleCatalog(
  models: ComputeModel[],
  providers: ComputeProvider[],
  error: string,
  syncedAt: string,
): ModelCatalog {
  return {
    models,
    providers,
    source: "ai-gateway",
    fetchedAt: syncedAt,
    stale: true,
    error,
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

/** 按站内 slug 查找模型：单行查询，避免为一条详情拉取整个目录 */
export async function getCatalogModelBySlug(slug: string): Promise<ComputeModel | null> {
  if (!isDatabaseConfigured()) {
    const catalog = await getModelCatalog()
    return catalog.models.find((model) => model.id === slug) ?? null
  }

  const fromDb = await readCatalogModelById(slug)
  if (fromDb) return fromDb

  // 库中无此条目（如刚上线）→ 触发一次同步后重试
  const catalog = await getModelCatalog({ force: true })
  return catalog.models.find((model) => model.id === slug) ?? null
}
