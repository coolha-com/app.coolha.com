import "server-only"

import { deriveProviders } from "@/lib/compute/service"
import type { ComputeModel, ComputeProvider } from "@/lib/compute/types"
import { CATALOG_CACHE_TAG, CATALOG_REVALIDATE_SECONDS } from "@/lib/ai-gateway/shared"
import { isInferenceReady } from "@/lib/inference/config"
import { getWhitelistedModels } from "@/lib/inference/openrouter-catalog"

/**
 * 模型目录读取层（仅服务端）。
 *
 * 2026-11-11：Vercel AI Gateway 团队被永久停用（疑似滥用，无申诉通道），
 * 全站已移除该上游：不再 fetch ai-gateway.vercel.sh，不再同步其目录快照，
 * 也不再依赖 AI_GATEWAY_* 环境变量。
 *
 * 模型广场布局保留。数据源是 OpenRouter 目录里、且落在 INFERENCE_MODELS
 * 白名单中的模型。目录失败时只暴露白名单 ID，价格显示为未提供。
 *
 * 绝不把演示数据伪装成实时数据，也绝不返回占位价格/评分（项目铁律）。
 */

export { CATALOG_REVALIDATE_SECONDS, CATALOG_CACHE_TAG }

/** 兼容旧引用；真正的推理 readiness 在 inference/config */
export function isAiGatewayConfigured(): boolean {
  return isInferenceReady()
}

/** 错误码部分（去掉 `:提示` 后缀），供健康检查展示 */
export function gatewayErrorCode(error: string | null | undefined): string {
  if (!error) return "UNKNOWN"
  const colon = error.indexOf(":")
  return colon > 0 ? error.slice(0, colon) : error
}

/** 是否存在真实上游故障（现在没有上游回源，恒为 false） */
export function isRealGatewayFailure(error: string | null | undefined): boolean {
  if (!error) return false
  const code = gatewayErrorCode(error)
  return code !== "RENDER_ABORTED" && code !== "SYNC_IN_PROGRESS"
}

export type CatalogSource = "demo" | "inference"

export interface ModelCatalog {
  models: ComputeModel[]
  providers: ComputeProvider[]
  source: CatalogSource
  fetchedAt: string
  /** true = 目录元数据没取到，或白名单为空。模型 ID 仍可能可调用。 */
  stale: boolean
  error?: string
}

/**
 * 模型目录 = INFERENCE_MODELS 白名单，规格来自 OpenRouter /api/v1/models。
 * options.force 会跳过进程内缓存再拉一次上游。
 * 拉不到目录时仍返回白名单 ID，不回退演示模型，也不填假价格。
 */
export async function getModelCatalog(options?: { force?: boolean }): Promise<ModelCatalog> {
  const listed = await getWhitelistedModels(options?.force === true)
  return {
    models: listed.models,
    providers: deriveProviders(listed.models),
    source: "inference",
    fetchedAt: listed.fetchedAt,
    stale: listed.stale,
    error: listed.error,
  }
}

/** 列表卡片摘要最大长度 */
const LIST_SUMMARY_MAX_LENGTH = 180

/** 列表页载荷瘦身：只保留卡片渲染与筛选所需字段 */
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
    tags: model.tags,
  }
}

/** 按站内 slug 查找模型：只在白名单目录里查 */
export async function getCatalogModelBySlug(slug: string): Promise<ComputeModel | null> {
  const catalog = await getModelCatalog()
  return catalog.models.find((model) => model.id === slug) ?? null
}
