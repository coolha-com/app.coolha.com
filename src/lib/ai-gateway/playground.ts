import "server-only"

import { INFERENCE_DEFAULT_MODEL } from "@/lib/inference/config"
import { getModelCatalog } from "@/lib/ai-gateway/client"
import type { PlaygroundModel, PlaygroundModels } from "./shared"

export { isFreeModel, isSponsorableModel } from "./shared"
export type { PlaygroundModel, PlaygroundModels } from "./shared"

/**
 * Chat 可选模型 = 统一推理网关 INFERENCE_MODELS 白名单。
 * 规格与价格来自 OpenRouter 目录；没有的字段保持空，UI 显示「未提供」。
 */

/** 兼容旧引用；真实默认模型由 INFERENCE_DEFAULT_MODEL 决定 */
export const DEFAULT_PLAYGROUND_MODEL_ID = INFERENCE_DEFAULT_MODEL

export async function getPlaygroundModels(): Promise<PlaygroundModels> {
  const catalog = await getModelCatalog()
  const models = catalog.models.map<PlaygroundModel>((model) => ({
    id: model.id,
    name: model.name,
    modelId: model.modelId,
    providerId: model.providerId,
    providerName: model.providerName,
    type: model.type,
    tags: model.tags ?? [],
    contextLength: model.contextLength,
    maxOutputTokens: model.maxOutputTokens,
    inputPricePerMillionUsd: model.inputPricePerMillionUsd,
    outputPricePerMillionUsd: model.outputPricePerMillionUsd,
    gatewayType: model.gatewayType,
    dataSource: model.dataSource,
    zeroDataRetention: model.zeroDataRetention ?? null,
    noTraining: model.noTraining ?? null,
  }))

  const preferred = models.find((model) => model.modelId === INFERENCE_DEFAULT_MODEL)
  const chosen = preferred ?? models[0] ?? null

  return {
    models,
    defaultSlug: chosen?.id ?? null,
    defaultIsFree: false,
  }
}
