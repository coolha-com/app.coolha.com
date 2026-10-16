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

/**
 * 同步失败后的退避窗口（秒）。
 *
 * 没有退避时，上游一旦失败（key 失效 401、限流 429、宕机 5xx），
 * 快照永远停留在「不新鲜」状态 → **每次页面渲染都重新打一次上游并打一条 error**。
 * 失败后在窗口内直接复用陈旧快照，不回源、不重复报错。
 */
export const CATALOG_RETRY_BACKOFF_SECONDS = 300

/**
 * 凭证类失败（401/403）的退避窗口（秒）——更长。
 *
 * 判据是「数据政策」而不是价格：
 * key 失效不会因为重试而自愈，必须人工轮换；用 1 小时窗口轮询上游毫无意义，
 * 只会持续消耗配额并在日志里刷屏。5 分钟给「刚轮换完 key 想立刻生效」留出口，
 * 运维同时可以用 /api/v1/models?refresh=1 强制立即回源。
 */
export const CATALOG_AUTH_BACKOFF_SECONDS = 300

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

/**
 * Stealth Model（预发布测试模型，modelId 以 `stealth/` 开头）。
 *
 * AI Product Terms §8.2 明确：Stealth Models 的 Customer Content 保护条款**不适用**——
 * 第三方 AI 提供商可能使用 Inputs 训练并改进其产品与服务，并可能对 Output 主张知识产权。
 * 因此公开产品不向终端用户提供这类模型（服务端路由同样硬拦）。
 */
export function isStealthModel(model: Pick<ComputeModel, "modelId">): boolean {
  return typeof model.modelId === "string" && model.modelId.startsWith("stealth/")
}

/**
 * 「可赞助」模型：Coolha 愿意替用户付推理费的那个集合。
 *
 * 判据是**数据政策**而不是价格：
 *   1. 零数据保留（zeroDataRetention === "all"）—— 供应商不保留 prompt 数据；
 *   2. 不用于训练（noTraining === "all"）—— 供应商承诺不用 Inputs 训练；
 *   3. 非 Stealth Model —— AI Product Terms §8.2 下 stealth 模型无任何数据保护。
 *
 * 为什么不能按「价格 0」挑：实测免费语言模型（nemotron-free / stealth-cat-jam /
 * stealth-glyph-cluster / poolside-laguna-s-2.1-free）**全部** zdr=none + noTrain=none，
 * 即免费额度是靠「让供应商拿数据训练」换来的。Coolha 不做这个交易。
 *
 * 代价由每日 token 配额（plans.ts）与请求次数双重封顶，见 route.ts 的同源硬门禁。
 */
export function isSponsorableModel(
  model: Pick<ComputeModel, "modelId" | "zeroDataRetention" | "noTraining">,
): boolean {
  if (isStealthModel(model)) return false
  return model.zeroDataRetention === "all" && model.noTraining === "all"
}

/** 赞助模型的输入单价上限（USD / 百万 token），防止误配昂贵模型烧穿获客预算 */
export const SPONSORED_MAX_INPUT_PRICE_PER_MILLION = 1

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
  | "zeroDataRetention"
  | "noTraining"
>

export interface PlaygroundModels {
  models: PlaygroundModel[]
  /** 默认选中模型的站内 slug；目录不可用时为 null */
  defaultSlug: string | null
  /** 该模型是否确实免费（用于 UI 提示） */
  defaultIsFree: boolean
}
