import type { ComputeModel } from "@/lib/compute/types"

/**
 * 同构模块：客户端组件也会引用的纯类型与纯函数。
 *
 * 严禁在此引入 DB（pg）、上游 fetch 或服务端密钥——本文件会进入浏览器包，
 * 任何 Node 依赖都会导致 webpack 在客户端包解析 'fs' 失败。
 * 服务端专用的目录读取在 ./client.ts（已标记 server-only）。
 */

/** 目录快照有效期（秒）：到期后才允许回源上游 */
export const CATALOG_REVALIDATE_SECONDS = 3600

/** Next Data Cache 标签：目录同步成功后主动失效 */
export const CATALOG_CACHE_TAG = "ai-gateway-models"

/** 免费判定只需要价格与标签，故放宽入参类型以兼容精简后的模型对象 */
export type PriceLike = Pick<
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
