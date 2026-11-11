import "server-only"

import { DEMO_MODELS } from "@/lib/compute/catalog"
import { deriveProviders } from "@/lib/compute/service"
import type { ComputeModel, ComputeProvider } from "@/lib/compute/types"
import { CATALOG_CACHE_TAG, CATALOG_REVALIDATE_SECONDS } from "@/lib/ai-gateway/shared"
import { isInferenceReady } from "@/lib/inference/config"

/**
 * 模型目录读取层（仅服务端）。
 *
 * 2026-11-11：Vercel AI Gateway 团队被永久停用（疑似滥用，无申诉通道），
 * 全站已移除该上游：不再 fetch ai-gateway.vercel.sh，不再同步其目录快照，
 * 也不再依赖 AI_GATEWAY_* 环境变量。
 *
 * 模型广场**布局保留**（页面 / 浏览器 / 表格 / 卡片组件不动），数据源暂时
 * 回退到 Phase 1 演示目录，并由页面明确标注「示例数据 · 推理网关未接入」。
 * 后续接入带目录接口的网关时，只需替换本文件的 getModelCatalog() 实现。
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
  /** true = 推理网关未接入，当前为演示布局数据 */
  stale: boolean
  error?: string
}

/**
 * 获取模型目录。目前固定返回演示目录 + 明确的未接入标记。
 * 保留 options.force 参数以兼容 /api/v1/models?refresh=1，但不再有上游可刷新。
 */
export async function getModelCatalog(): Promise<ModelCatalog> {
  return {
    models: DEMO_MODELS,
    providers: deriveProviders(DEMO_MODELS),
    source: "demo",
    fetchedAt: new Date().toISOString(),
    stale: true,
    error: "INFERENCE_NOT_CONFIGURED",
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

/** 按站内 slug 查找模型：只在演示目录里查，不回源、不查旧快照表 */
export async function getCatalogModelBySlug(slug: string): Promise<ComputeModel | null> {
  const catalog = await getModelCatalog()
  return catalog.models.find((model) => model.id === slug) ?? null
}
