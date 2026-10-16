import "server-only"

import { getModelCatalog } from "./client"
import {
  isSponsorableModel,
  SPONSORED_MAX_INPUT_PRICE_PER_MILLION,
  type PlaygroundModel,
  type PlaygroundModels,
} from "./shared"

export { isFreeModel, isSponsorableModel } from "./shared"
export type { PlaygroundModel, PlaygroundModels } from "./shared"

/**
 * Chat 可选模型 = Coolha 愿意赞助推理费的那个集合。
 *
 * 准入判据（缺一不可）：
 *   1. gatewayType === "language" 且未下线；
 *   2. **零数据保留 + 不用于训练**（isSponsorableModel）—— 这是隐私底线，
 *      不是价格底线。实测「价格 0」的免费语言模型全部 zdr=none/noTrain=none，
 *      即免费额度靠让供应商拿数据训练换来，Coolha 不做这个交易；
 *   3. 非 Stealth Model（AI Product Terms §8.2 无数据保护）；
 *   4. 输入单价不超过 SPONSORED_MAX_INPUT_PRICE_PER_MILLION，防误配烧穿获客预算。
 *
 * 服务端路由（/api/compute/playground）有同源硬门禁兜底，客户端过滤只为体验。
 */

/** 默认赞助模型：开放权重、便宜、ZDR + 不训练。不在列表时回退到最便宜的安全模型 */
export const DEFAULT_PLAYGROUND_MODEL_ID = "openai/gpt-oss-20b"

export async function getPlaygroundModels(): Promise<PlaygroundModels> {
  const catalog = await getModelCatalog()

  const models = catalog.models
    .filter(
      (model) =>
        model.gatewayType === "language" &&
        model.status !== "maintenance" &&
        isSponsorableModel(model) &&
        model.inputPricePerMillionUsd <= SPONSORED_MAX_INPUT_PRICE_PER_MILLION,
    )
    // 便宜优先，让默认档落在低成本模型上
    .sort((a, b) => a.inputPricePerMillionUsd - b.inputPricePerMillionUsd)
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
      zeroDataRetention: model.zeroDataRetention,
      noTraining: model.noTraining,
    }))

  const preferred = models.find((model) => model.modelId === DEFAULT_PLAYGROUND_MODEL_ID)
  const chosen = preferred ?? models[0] ?? null

  return {
    models,
    defaultSlug: chosen?.id ?? null,
    defaultIsFree: Boolean(chosen),
  }
}
