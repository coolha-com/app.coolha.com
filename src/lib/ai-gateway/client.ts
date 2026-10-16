import "server-only"

import { revalidateTag } from "next/cache"
import { DEMO_MODELS } from "@/lib/compute/catalog"
import { isDatabaseConfigured } from "@/lib/neon/postgres"
import { deriveProviders } from "@/lib/compute/service"
import type { ComputeModel, ComputeProvider } from "@/lib/compute/types"
import {
  CATALOG_AUTH_BACKOFF_SECONDS,
  CATALOG_CACHE_TAG,
  CATALOG_RETRY_BACKOFF_SECONDS,
  CATALOG_REVALIDATE_SECONDS,
} from "@/lib/ai-gateway/shared"
import {
  claimCatalogSync,
  readCachedCatalogSnapshot,
  readCatalogModelById,
  readCatalogSyncMeta,
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

/**
 * 错误串可能形如 `UPSTREAM_401:<上游提示>`，故一律用前缀判定，不要用相等比较。
 * 凭证类失败：key 失效不会自愈，退避窗口更长。
 */
function isAuthFailure(error: string | undefined): boolean {
  return error?.startsWith("UPSTREAM_401") === true || error?.startsWith("UPSTREAM_403") === true
}

/** 取错误码部分（去掉 `:提示` 后缀），用于稳定比对与展示 */
export function gatewayErrorCode(error: string | null | undefined): string {
  if (!error) return "UNKNOWN"
  const colon = error.indexOf(":")
  return colon > 0 ? error.slice(0, colon) : error
}

/**
 * 是否为「真实的上游故障」。
 * RENDER_ABORTED 表示静态预渲染被框架中断（正常路径），不算网关故障，
 * 不能让 /api/health 因此报 503。
 */
export function isRealGatewayFailure(error: string | null | undefined): boolean {
  if (!error) return false
  const code = gatewayErrorCode(error)
  return code !== "RENDER_ABORTED" && code !== "SYNC_IN_PROGRESS"
}

/** 把上游状态码翻译成运维能直接行动的一句话 */
function describeGatewayError(message: string): string {
  const code = gatewayErrorCode(message)
  const hint = message.includes(":") ? message.slice(message.indexOf(":") + 1).trim() : ""
  switch (code) {
    case "UPSTREAM_401":
      return `AI_GATEWAY_API_KEY 无效或已被回收（上游 401）。需在 Vercel AI Gateway 重新生成 key${hint ? `｜上游提示：${hint}` : ""}`
    case "UPSTREAM_403":
      return `AI Gateway 拒绝访问（上游 403）：key 无该目录权限${hint ? `｜上游提示：${hint}` : ""}`
    case "UPSTREAM_429":
      return `AI Gateway 限流（上游 429）：请检查 Credits 余额或稍后重试${hint ? `｜上游提示：${hint}` : ""}`
    case "AI_GATEWAY_API_KEY_NOT_SET":
      return "AI_GATEWAY_API_KEY 未配置"
    default:
      return message
  }
}

/** 退避判定只需要同步元信息，不必拉全量模型 */
interface CatalogFailureMeta {
  lastError: string | null
  failedAt: string | null
}

/**
 * Next.js 控制流信号（`digest === "DYNAMIC_SERVER_USAGE"`）必须原样抛出。
 *
 * 这不是上游故障，而是框架在「静态预渲染时遇到 no-store 数据」时用来中断预渲染、
 * 改走动态渲染的内部信号。把它当同步失败吞掉会造成两个真实问题：
 *   1. last_error 被写成一条与网关无关的构建错误，掩盖真正的 401/429；
 *   2. failed_at 被置位 → 触发退避 → 构建期那次失败把后续真实错误也挡在窗口外。
 */
function isNextControlFlowSignal(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    (error as { digest?: unknown }).digest === "DYNAMIC_SERVER_USAGE"
  )
}

/**
 * 失败退避判定：窗口内直接复用陈旧快照，不回源、不重复报错。
 *
 * 必须读**未缓存**的同步元信息：Data Cache（TTL 1 小时）里存的是失败发生前
 * 写入的快照，其 failedAt 为空，据此判定永远不成立 → 每次渲染都重打上游。
 *
 * force=true 时跳过退避（供 /api/v1/models?refresh=1 人工强制刷新），
 * 便于 key 轮换后立刻生效，不必等满窗口。
 */
function isInBackoffWindow(meta: CatalogFailureMeta | null, force: boolean, nowMs: number): boolean {
  if (force) return false
  if (!meta?.failedAt || !meta.lastError) return false
  const windowSeconds = isAuthFailure(meta.lastError)
    ? CATALOG_AUTH_BACKOFF_SECONDS
    : CATALOG_RETRY_BACKOFF_SECONDS
  const failedMs = new Date(meta.failedAt).getTime()
  if (Number.isNaN(failedMs)) return false
  return nowMs - failedMs < windowSeconds * 1000
}

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

/**
 * 拉取上游原始模型列表；失败时抛出带状态的错误。同步路径一律 no-store（快照新鲜度由库保证）。
 *
 * 保留上游错误正文的前若干字符：Vercel 返回的 401 会直接给出「去哪儿生成新 key」的链接，
 * 只留状态码的话运维看到 UPSTREAM_401 无法行动。
 */
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
    throw new Error(`UPSTREAM_${response.status}:${await readUpstreamHint(response)}`)
  }

  const json = (await response.json()) as GatewayModelsResponse
  const raw = Array.isArray(json?.data) ? json.data : []
  if (raw.length === 0) throw new Error("UPSTREAM_EMPTY")
  return raw
}

/** 抽取上游错误正文里的可行动提示（截断，避免把整页 HTML 写进日志） */
async function readUpstreamHint(response: Response): Promise<string> {
  try {
    const text = await response.text()
    if (!text) return ""
    const message = text.match(/"message"\s*:\s*"([^"]+)"/)?.[1]
    const hint = (message ?? text).replace(/\s+/g, " ").trim()
    return hint.slice(0, 200)
  } catch {
    return ""
  }
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

  // 1.5) 失败退避：上一次回源失败且仍在窗口内 → 直接复用陈旧快照。
  // 没有这一步，坏 key 会让每次页面渲染都重打上游并刷一条 error（synced_at 不推进，
  // 快照永远「不新鲜」）。读未缓存的元信息，因为 Data Cache 里的快照早于本次失败。
  // key 轮换后可走 /api/v1/models?refresh=1（force）立即生效，不必等满窗口。
  const syncMeta = force ? null : await readCatalogSyncMeta()
  if (snapshot && isInBackoffWindow(syncMeta, force, Date.now())) {
    return toStaleCatalog(
      snapshot.models,
      snapshot.providers,
      syncMeta!.lastError!,
      snapshot.syncedAt,
    )
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
    // 注意：本函数可能在页面 render 阶段被调用（/chat、/ai/models），此时 Next 禁止 revalidateTag，
    // 只能捕获后依赖页面自身的 revalidate 自愈——不能让它把一次成功的同步记成失败。
    try {
      revalidateTag(CATALOG_CACHE_TAG, "max")
    } catch (error) {
      console.warn(
        "[ai-gateway] Data Cache 失效跳过（render 阶段不可调用 revalidateTag，将由页面 revalidate 自愈）:",
        error instanceof Error ? error.message : error,
      )
    }

    return {
      models,
      providers: deriveProviders(models),
      source: "ai-gateway",
      fetchedAt: new Date().toISOString(),
      stale: false,
    }
  } catch (error) {
    // 框架控制流信号不是故障：原样抛出，让 Next 决定如何渲染。
    // 但锁必须先释放——否则这次预渲染中断会把锁按住到超时（120s）才允许下次同步。
    if (isNextControlFlowSignal(error)) {
      await releaseCatalogSync(false, { error: "RENDER_ABORTED" }).catch(() => {})
      throw error
    }

    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR"
    const described = describeGatewayError(message)
    // 退避窗口内后续渲染不会再走到这里（见 isInBackoffWindow），所以这条日志
    // 每个退避周期只会出现一次，不会变成每次渲染都刷屏。
    console.error(`[ai-gateway] 同步模型目录失败: ${message} — ${described}`)
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
