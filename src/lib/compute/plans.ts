/**
 * 档位配置（同构模块：客户端与服务端共用）。
 * 禁止在此引入 server-only 依赖或环境变量。
 *
 * 定价、权益矩阵与链上收款方案见 docs/PRICING_AND_ENTITLEMENTS.md。
 *
 * ⚠️ 两条不可碰的红线（已核实，见 docs/ENTITLEMENT_ENFORCEMENT_STATUS.md 第十节）：
 *
 * 1. **付费档位不得按 token 额度区分。**
 *    Vercel AUP 禁 "sell access / make Services available to any third party"，
 *    AI Product Terms §2 的许可仅限 personal or internal business use。
 *    「Plus 1.5M / Pro 6M / Ultra 25M tokens」= 付钱买更多第三方模型算力访问权 = 变相转售。
 *    因此赞助额度是**全体登录用户统一的常量**，与档位完全解耦：
 *    所有档位拿到的免费模型额度一模一样，超限解法是接自己的 Key，不是升级。
 *
 * 2. 付费解锁的只能是 Coolha 自己的软件能力（历史 / 同步 / 检索 / 导出 / 编排）。
 *
 * 3. **已从档位中移除的两个字段**（曾存在，均为 access 差异，无法辩护）：
 *    - `queuePriority`（付费优先排队）—— 优先处理付费请求 = 按付费分配推理资源。
 *    - `concurrentSessions`（并发会话数）—— 若指同时发起的推理请求数，同样是 access 差异；
 *      需要限流时用全局的 `SPONSORED_DAILY_REQUESTS`，与档位无关。
 */

export type PlanId = "free" | "plus" | "pro" | "ultra"

export const PLAN_ORDER: PlanId[] = ["free", "plus", "pro", "ultra"]

/**
 * 赞助额度（免费模型通道，Coolha 出钱的部分）；UTC 自然日窗口。
 *
 * **刻意做成全局常量而非档位字段**：见文件头红线 1。
 * 这是获客成本（营销预算），不是产品功能，因此对所有登录用户一视同仁。
 * 调整它只影响我们烧多少钱，不影响任何人的付费权益——也就不构成「卖算力」。
 */
export const SPONSORED_DAILY_TOKENS = 300_000
export const SPONSORED_DAILY_REQUESTS = 30

export interface PlanLimits {
  /** BYOK 连接数；null = 无限 */
  byokConnections: number | null
  /** 服务端历史保留天数；null = 永久；0 = 不提供 */
  historyDays: number | null
  /** 服务端历史条数上限；null = 无限 */
  historyThreads: number | null
  crossDeviceSync: boolean
  fullTextSearch: boolean
  exportScope: "none" | "single" | "batch" | "scheduled"
  /** Persona / 系统提示词预设数；null = 无限 */
  personas: number | null
  /** Prompt 模板数；null = 无限 */
  promptTemplates: number | null
  /** 多模型并排对比路数 */
  parallelCompare: number
  /** 路由策略：fallback 顺序 / 超时 / 重试 / 单次成本上限 */
  routingPolicies: boolean
  /** 成本看板回看天数；null = 永久 */
  costDashboardDays: number | null
  /** API / Webhook / MCP 出口（用用户自己的 Key） */
  apiAccess: boolean
}

export interface PlanDefinition {
  id: PlanId
  name: string
  /** 月价（USD）；链上以 USDC / USDT 结算 */
  priceUsd: number
  tagline: string
  limits: PlanLimits
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    tagline: "本地历史 + 每日免费额度，或接自己的 Key",
    limits: {
      byokConnections: 2,
      historyDays: 0,
      historyThreads: null,
      crossDeviceSync: false,
      fullTextSearch: false,
      exportScope: "none",
      personas: 1,
      promptTemplates: 0,
      parallelCompare: 0,
      routingPolicies: false,
      costDashboardDays: 0,
      apiAccess: false,
    },
  },
  plus: {
    id: "plus",
    name: "Plus",
    priceUsd: 6,
    tagline: "云端历史与跨设备同步，导出",
    limits: {
      byokConnections: 5,
      historyDays: 90,
      historyThreads: 500,
      crossDeviceSync: true,
      fullTextSearch: false,
      exportScope: "single",
      personas: 10,
      promptTemplates: 5,
      parallelCompare: 0,
      routingPolicies: false,
      costDashboardDays: 90,
      apiAccess: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 10,
    tagline: "全文检索，历史保留一年",
    limits: {
      byokConnections: 15,
      historyDays: 365,
      historyThreads: 5_000,
      crossDeviceSync: true,
      fullTextSearch: true,
      exportScope: "batch",
      personas: null,
      promptTemplates: null,
      parallelCompare: 2,
      routingPolicies: true,
      costDashboardDays: 365,
      apiAccess: true,
    },
  },
  ultra: {
    id: "ultra",
    name: "Ultra",
    priceUsd: 30,
    tagline: "永久归档，不限量",
    limits: {
      byokConnections: null,
      historyDays: null,
      historyThreads: null,
      crossDeviceSync: true,
      fullTextSearch: true,
      exportScope: "scheduled",
      personas: null,
      promptTemplates: null,
      parallelCompare: 4,
      routingPolicies: true,
      costDashboardDays: null,
      apiAccess: true,
    },
  },
}

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && value in PLANS
}

/** 从任意来源（DB / Cookie / 默认值）安全解析档位，未知一律降级为 free */
export function resolvePlan(value: string | null | undefined): PlanDefinition {
  return isPlanId(value) ? PLANS[value] : PLANS.free
}

/** 人类可读的 token 量级，例如 300K / 1.5M */
export function formatTokens(value: number): string {
  if (!Number.isFinite(value)) return "—"
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `${millions % 1 === 0 ? millions : millions.toFixed(1)}M`
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return String(value)
}

/** 下一个 UTC 零点的 ISO 时间（额度重置时刻） */
export function nextUtcMidnightIso(now = new Date()): string {
  const next = new Date(now)
  next.setUTCHours(24, 0, 0, 0)
  return next.toISOString()
}
