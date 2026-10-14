import { getModelCatalog } from "./client"
import type { ComputeModel } from "@/lib/compute/types"

/**
 * Playground 可选模型：真实目录中可对话（gatewayType === "language"）且未下线的模型。
 *
 * 默认模型优先选上游标注为免费的条目——Playground 对访问者免费开放，
 * 默认模型必须零成本，避免开放体验产生不可控账单。
 */

export const DEFAULT_PLAYGROUND_MODEL_ID = "nvidia/nemotron-3.5-lightning-free"

/** 免费判定只需要价格与标签，故放宽入参类型以兼容精简后的模型对象 */
type PriceLike = Pick<
  ComputeModel,
  "tags" | "inputPricePerMillionUsd" | "outputPricePerMillionUsd"
>

/** 免费判定：上游 free 标签，或输入/输出价格均为 0 */
export function isFreeModel(model: PriceLike): boolean {
  if (model.tags?.includes("free")) return true
  return model.inputPricePerMillionUsd === 0 && model.outputPricePerMillionUsd === 0
}

/** 传给客户端的最小字段集：避免把数百个模型的完整规格塞进首屏载荷 */
export type PlaygroundModel = Pick<
  ComputeModel,
  | "id"
  | "name"
  | "modelId"
  | "providerId"
  | "providerName"
  | "type"
  | "tags"
  | "contextLength"
  | "maxOutputTokens"
  | "inputPricePerMillionUsd"
  | "outputPricePerMillionUsd"
  | "gatewayType"
  | "dataSource"
>

export interface PlaygroundModels {
  models: PlaygroundModel[]
  /** 默认选中模型的站内 slug；目录不可用时为 null */
  defaultSlug: string | null
  /** 该模型是否确实免费（用于 UI 提示） */
  defaultIsFree: boolean
}

export async function getPlaygroundModels(): Promise<PlaygroundModels> {
  const catalog = await getModelCatalog()

  const models = catalog.models
    .filter((model) => model.gatewayType === "language" && model.status !== "maintenance")
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
