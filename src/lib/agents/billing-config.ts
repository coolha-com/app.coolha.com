/**
 * 按次付费的 Agent 服务：商业参数（唯一真相源）。
 *
 * 口径（2026-11-12 定稿）：
 *  - 19 U/次：一次购买 = 一份「服务授权」，法币收款由 Waffo 作 Merchant of Record 承载；
 *  - 期限一个月：授权自发放起 30 天内有效，过期即失效；
 *  - token 消耗上限：授权内 token 累计价值到 10 美元后停用。
 *
 * ⚠️ 合规口径（AaaS）：对外卖的是 **Agent 执行与交付服务**，按次收费。
 * token 上限是**成本护栏**（防止单次任务把平台的模型成本打穿），
 * 不是对外的计费单位、不作为档位区分、也不宣传——避免被读成「按 token 分档售卖」。
 */

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

/** 一次购买的价格（USD），与 Waffo 商品价格一致 */
export const AGENT_SERVICE_PRICE_USD = numEnv("AGENT_SERVICE_PRICE_USD", 19)

/** 一份授权的有效期（天） */
export const AGENT_GRANT_VALIDITY_DAYS = numEnv("AGENT_GRANT_VALIDITY_DAYS", 30)

/** 一份授权内允许消耗的 token 价值上限（USD） */
export const AGENT_TOKEN_BUDGET_USD = numEnv("AGENT_TOKEN_BUDGET_USD", 10)
