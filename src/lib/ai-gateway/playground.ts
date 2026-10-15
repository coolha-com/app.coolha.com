import "server-only"

import { getModelCatalog } from "./client"
import { isFreeModel, type PlaygroundModel, type PlaygroundModels } from "./shared"

export { isFreeModel } from "./shared"
export type { PlaygroundModel, PlaygroundModels } from "./shared"

/**
 * Playground 可选模型：真实目录中可对话（gatewayType === "language"）、未下线、且**免费**。
 *
 * 免费判定优先看上游 free 标签，其次要求输入/输出价格均为 0。
 * 付费模型不进入列表（订阅制开放前不对外提供），服务端路由另有同源硬门禁兜底。
 */

export const DEFAULT_PLAYGROUND_MODEL_ID = "nvidia/nemotron-3.5-lightning-free"

export async function getPlaygroundModels(): Promise<PlaygroundModels> {
  const catalog = await getModelCatalog()

  const models = catalog.models
    .filter(
      (model) =>
        model.gatewayType === "language" &&
        model.status !== "maintenance" &&
        isFreeModel(model),
    )
    // 免费优先，其次便宜的排前面
    .sort((a, b) => {
      const freeDiff = Number(isFreeModel(b)) - Number(isFreeModel(a))
      if (freeDiff !== 0) return freeDiff
      return a.inputPricePerMillionUsd - b.inputPricePerMillionUsd
    })
    .map<PlaygroundModel>((model) => ({
      id: model.id,
      name: model.name,
      modelId: model.modelId,
      providerId: model.providerId,
      providerName: model.providerName,
      type: model.type,
      tags: model.tags,
      contextLength: model.contextLength,
      maxOutputTokens: model.maxOutputTokens,
      inputPricePerMillionUsd: model.inputPricePerMillionUsd,
      outputPricePerMillionUsd: model.outputPricePerMillionUsd,
      gatewayType: model.gatewayType,
      dataSource: model.dataSource,
    }))

  const preferred = models.find((model) => model.modelId === DEFAULT_PLAYGROUND_MODEL_ID)
  const fallback = models[0] ?? null
  const chosen = preferred ?? fallback

  return {
    models,
    defaultSlug: chosen?.id ?? null,
    defaultIsFree: chosen ? isFreeModel(chosen) : false,
  }
}
