import "server-only"

/**
 * OpenRouter 模型单价（USD / token）。
 *
 * 计费需要把 token 数换算成钱，就必须有一份权威单价。
 * OpenRouter 的公开目录 `GET /api/v1/models` 给出每个模型的 pricing（prompt /
 * completion / input_cache_read，都是每 token 的美元价），不需要密钥。
 *
 * 诚实纪律：
 *  - 拿不到单价 → 返回 null，调用方记 token 不记钱，**绝不猜一个价格**；
 *  - 目录里没有该模型 → 同样返回 null。
 *
 * 进程内缓存 10 分钟：单价不常变，但也不必每次推理都打一次外网。
 */

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
const CACHE_TTL_MS = 10 * 60 * 1000

export interface ModelPricing {
  /** 每 token 的美元价（输入） */
  prompt: number
  /** 每 token 的美元价（输出） */
  completion: number
  /** 每 token 的美元价（命中缓存的输入） */
  cacheRead: number
}

interface CacheEntry {
  at: number
  byId: Map<string, ModelPricing>
}

let cache: CacheEntry | null = null

/**
 * eve 上报的 modelId 形如 "OpenRouter/deepseek/deepseek-v4.1-flash-1017"
 * （第一段是我们配置的网关名），而 OpenRouter 目录里的 id 是
 * "deepseek/deepseek-v4.1-flash-1017"。
 *
 * ⚠️ 不能无脑剥第一段："deepseek" 既是厂商名也是模型名的一部分
 * （deepseek/deepseek-v4.1-flash-1017 本身就是目录里的 id）。
 * 所以策略是：**先按原样查，查不到再剥掉第一段**。
 */
export function candidateModelIds(modelId: string): string[] {
  const raw = modelId.trim()
  if (!raw) return []
  const candidates = [raw]
  const slash = raw.indexOf("/")
  if (slash > 0 && slash < raw.length - 1) {
    candidates.push(raw.slice(slash + 1))
  }
  return candidates
}

async function loadPricing(): Promise<Map<string, ModelPricing>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.byId
  const response = await fetch(OPENROUTER_MODELS_URL, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`OpenRouter 模型目录不可用（${response.status}）`)
  }
  const body = (await response.json()) as {
    data?: { id?: string; pricing?: Record<string, string> }[]
  }
  const byId = new Map<string, ModelPricing>()
  for (const model of body.data ?? []) {
    if (!model.id || !model.pricing) continue
    const prompt = Number(model.pricing.prompt)
    const completion = Number(model.pricing.completion)
    const cacheRead = Number(model.pricing.input_cache_read)
    if (!Number.isFinite(prompt) || !Number.isFinite(completion)) continue
    byId.set(model.id, {
      prompt,
      completion,
      cacheRead: Number.isFinite(cacheRead) ? cacheRead : prompt,
    })
  }
  cache = { at: Date.now(), byId }
  return byId
}

/**
 * 取某个模型的单价。取不到返回 null（调用方必须如实按「无成本」处理，不能编造）。
 */
export async function resolveModelPricing(modelId: string): Promise<ModelPricing | null> {
  const candidates = candidateModelIds(modelId)
  if (candidates.length === 0) return null
  try {
    const byId = await loadPricing()
    for (const id of candidates) {
      const pricing = byId.get(id)
      if (pricing) return pricing
    }
    // 目录里没有这个模型：这是配置问题（白名单里的模型不在 OpenRouter 目录），要看得见
    console.error(
      `[pricing] OpenRouter 目录里没有模型 ${candidates.join(" / ")}，本次不记账金额`,
    )
    return null
  } catch (error) {
    // 目录不可用：这次拿不到单价 → 不记账金额（留 NULL），但 token 照记
    console.error("[pricing] 拉取 OpenRouter 模型目录失败:", error)
    return null
  }
}

/**
 * 把一次推理的 token 数换算成美元。
 * @returns 拿不到单价时返回 null（**不返回 0**，0 会被读成「这次没花钱」）
 */
export async function estimateCostUsd(input: {
  modelId: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
}): Promise<number | null> {
  const pricing = await resolveModelPricing(input.modelId)
  if (!pricing) return null
  const inputTokens = Math.max(0, input.inputTokens)
  const outputTokens = Math.max(0, input.outputTokens)
  const cacheReadTokens = Math.max(0, input.cacheReadTokens ?? 0)
  const cost =
    inputTokens * pricing.prompt +
    outputTokens * pricing.completion +
    cacheReadTokens * pricing.cacheRead
  return Number.isFinite(cost) ? cost : null
}
