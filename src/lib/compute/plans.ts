/**
 * 档位配置（同构模块：客户端与服务端共用）。
 * 禁止在此引入 server-only 依赖或环境变量。
 *
 * 定价、权益矩阵与链上收款方案见 docs/PRICING_AND_ENTITLEMENTS.md。
 * 核心红线：付费解锁的是**软件能力**，不是模型算力；推理费用由用户自己的 Key 承担。
 */

export type PlanId = "free" | "plus" | "pro" | "ultra"

export const PLAN_ORDER: PlanId[] = ["free", "plus", "pro", "ultra"]

/** 赞助额度（免费模型，Coolha 出钱的部分）；UTC 自然日窗口 */
export interface PlanQuota {
  /** 每日 token 上限（input + output） */
  dailyTokens: number
  /** 每日请求上限（防刷硬顶，长上下文单请求可能一次吃掉全天 token） */
  dailyRequests: number
}

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
  /** 并发会话数；null = 无限 */
  concurrentSessions: number | null
  teamSeats: number
  /** API / Webhook / MCP 出口（用用户自己的 Key） */
  apiAccess: boolean
  queuePriority: "low" | "normal" | "high" | "highest"
}

export interface PlanDefinition {
  id: PlanId
  name: string
  /** 月价（USD）；链上以 USDC / USDT 结算 */
  priceUsd: number
  tagline: string
  quota: PlanQuota
  limits: PlanLimits
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    priceUsd: 0,
    tagline: "体验免费模型，或接自己的 Key",
    quota: { dailyTokens: 300_000, dailyRequests: 30 },
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
      concurrentSessions: 1,
      teamSeats: 0,
      apiAccess: false,
      queuePriority: "low",
    },
  },
  plus: {
    id: "plus",
    name: "Plus",
    priceUsd: 6,
    tagline: "同步与导出，多连接管理",
    quota: { dailyTokens: 1_500_000, dailyRequests: 120 },
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
      concurrentSessions: 3,
      teamSeats: 0,
      apiAccess: false,
      queuePriority: "normal",
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceUsd: 10,
    tagline: "全文检索、模型对比、路由策略",
    quota: { dailyTokens: 6_000_000, dailyRequests: 400 },
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
      concurrentSessions: 10,
      teamSeats: 1,
      apiAccess: true,
      queuePriority: "high",
    },
  },
  ultra: {
    id: "ultra",
    name: "Ultra",
    priceUsd: 30,
    tagline: "永久归档、团队席位与最高优先级",
    quota: { dailyTokens: 25_000_000, dailyRequests: 1_200 },
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
      concurrentSessions: null,
      teamSeats: 5,
      apiAccess: true,
      queuePriority: "highest",
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
