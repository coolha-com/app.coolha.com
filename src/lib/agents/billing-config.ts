/**
 * Agent 服务的成本护栏（唯一真相源）。
 *
 * 2026-11-12：Waffo 收款已移除。当前阶段不收费、不模拟付款。
 * 下面的天数和美元上限只用于：
 *  - 已有的服务授权（历史发放的记录仍可消耗）；
 *  - local_open / preview_open 的测试预算，防止预览环境被无限调用。
 *
 * 对外卖的是 Agent 执行与交付，不是 token 档位。
 * 上限是成本护栏，不是价目表。
 */

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

/**
 * 预留的服务标价。当前没有任何收款入口读取它来发起支付。
 * 保留常量是为了以后接回商业化时不用再散落魔法数字；界面不得把它显示成待付款。
 */
export const AGENT_SERVICE_PRICE_USD = numEnv("AGENT_SERVICE_PRICE_USD", 19)

/**
 * 开放测试模式（local_open / preview_open）每主体、滚动 24 小时的请求次数上限。
 * 这是次数护栏，不是虚构单价。拿不到成本时靠它挡住无限调用。
 */
export function openModeRequestCap(): number {
  return numEnv("AGENT_OPEN_REQUEST_CAP", 40)
}

/** 一份授权的有效期（天） */
export const AGENT_GRANT_VALIDITY_DAYS = numEnv("AGENT_GRANT_VALIDITY_DAYS", 30)

/** 一份授权内允许消耗的 token 价值上限（USD） */
export const AGENT_TOKEN_BUDGET_USD = numEnv("AGENT_TOKEN_BUDGET_USD", 10)
