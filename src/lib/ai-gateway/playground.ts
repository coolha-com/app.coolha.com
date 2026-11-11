import "server-only"

import {
  INFERENCE_DEFAULT_MODEL,
  INFERENCE_GATEWAY_NAME,
  inferenceModelIds,
} from "@/lib/inference/config"
import type { PlaygroundModel, PlaygroundModels } from "./shared"

export { isFreeModel, isSponsorableModel } from "./shared"
export type { PlaygroundModel, PlaygroundModels } from "./shared"

/**
 * Chat 可选模型 = 统一推理网关 INFERENCE_MODELS 里登记的模型。
 *
 * Vercel AI Gateway 已于 2026-11-11 永久停用，全站不再依赖其目录。
 * 新网关只提供模型 ID，不提供价格 / ZDR / 训练政策等元数据：
 * 这些字段一律留空或标记为 mock，**绝不编造占位数值**（项目铁律）。
 * 模型广场保留布局，等接入带目录接口的网关后再替换本文件的数据源。
 */

/** 兼容旧引用；真实默认模型由 INFERENCE_DEFAULT_MODEL 决定 */
export const DEFAULT_PLAYGROUND_MODEL_ID = INFERENCE_DEFAULT_MODEL

/** 站内 slug：把厂商原生模型 ID 收敛成可用于 URL 的标识 */
function toSlug(modelId: string): string {
  return modelId.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase()
}

export async function getPlaygroundModels(): Promise<PlaygroundModels> {
  const ids = inferenceModelIds()

  const models = ids.map<PlaygroundModel>((modelId) => ({
    id: toSlug(modelId),
    name: modelId,
    modelId,
    providerId: "inference",
    providerName: INFERENCE_GATEWAY_NAME,
    type: "chat",
    tags: [],
    // 新网关未提供规格：一律 0 / null / mock 标记，UI 必须显示「未提供」
    contextLength: 0,
    maxOutputTokens: 0,
    inputPricePerMillionUsd: 0,
    outputPricePerMillionUsd: 0,
    gatewayType: "language",
    dataSource: "mock",
    zeroDataRetention: null,
    noTraining: null,
  }))

  const preferred = models.find((model) => model.modelId === INFERENCE_DEFAULT_MODEL)
  const chosen = preferred ?? models[0] ?? null

  return {
    models,
    defaultSlug: chosen?.id ?? null,
    defaultIsFree: false,
  }
}
