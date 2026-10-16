import "server-only"

import { isDatabaseConfigured, query } from "./postgres"
import {
  SPONSORED_DAILY_REQUESTS,
  SPONSORED_DAILY_TOKENS,
  nextUtcMidnightIso,
  resolvePlan,
  type PlanDefinition,
} from "@/lib/compute/plans"

/**
 * 赞助额度的每日计量（UTC 自然日窗口）。
 *
 * ⚠️ 额度是**全局常量**，不随档位变化——见 plans.ts 文件头红线 1：
 * 付费档位按 token 数区分 = 变相转售第三方模型算力（Vercel AUP "sell access"）。
 * 档位只决定软件能力；超限的正确解法是接自己的 Key，不是升级。
 *
 * 计量对象是「走我们 Gateway 的赞助模型」；BYOK 直连不经服务端，不计量也不限流。
 * DB 不可用时**fail-open**（按 0 放行并记日志）：宁可短时少记账，
 * 也不要因为账本抖动把产品打挂。真正的熔断靠 FREE_MODELS_ENABLED 开关。
 */

export interface DailyUsage {
  requests: number
  inputTokens: number
  outputTokens: number
  tokens: number
}

export interface QuotaDecision {
  allowed: boolean
  plan: PlanDefinition
  /** 触发拒绝的原因 */
  reason?: "REQUEST_LIMIT" | "TOKEN_LIMIT"
  used: DailyUsage
  resetAt: string
  /** 当日统一额度上限（与档位无关，仅用于错误提示） */
  dailyTokens: number
  dailyRequests: number
}

const ZERO_USAGE: DailyUsage = {
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  tokens: 0,
}

/** 读取用户档位；无记录 / 已过期 / 非 active 一律降级为 free */
export async function readPlan(subject: string): Promise<PlanDefinition> {
  if (!isDatabaseConfigured() || !subject) return resolvePlan(null)
  try {
    const { rows } = await query<{ plan: string; status: string; period_end: Date | null }>(
      `SELECT plan, status, period_end FROM entitlements WHERE subject = $1`,
      [subject],
    )
    const row = rows[0]
    if (!row) return resolvePlan(null)
    if (row.status !== "active") return resolvePlan(null)
    if (row.period_end && row.period_end.getTime() < Date.now()) return resolvePlan(null)
    return resolvePlan(row.plan)
  } catch (error) {
    console.error("[quota] 读取档位失败，按 free 放行:", error)
    return resolvePlan(null)
  }
}

/** 当日已用量（UTC 自然日） */
export async function readTodayUsage(subject: string): Promise<DailyUsage> {
  if (!isDatabaseConfigured() || !subject) return ZERO_USAGE
  try {
    const { rows } = await query<{
      requests: number
      input_tokens: string | number
      output_tokens: string | number
    }>(
      `SELECT requests, input_tokens, output_tokens
         FROM usage_daily
        WHERE subject = $1 AND day = (now() AT TIME ZONE 'UTC')::date`,
      [subject],
    )
    const row = rows[0]
    if (!row) return ZERO_USAGE
    const inputTokens = Number(row.input_tokens ?? 0)
    const outputTokens = Number(row.output_tokens ?? 0)
    return {
      requests: Number(row.requests ?? 0),
      inputTokens,
      outputTokens,
      tokens: inputTokens + outputTokens,
    }
  } catch (error) {
    console.error("[quota] 读取当日用量失败，按 0 计:", error)
    return ZERO_USAGE
  }
}

/**
 * 请求前判定：次数上限与 token 上限同时校验，任一触发即拒绝。
 *
 * 上限取全局常量（与档位无关），只做「已用 vs 上限」的粗校验，不做单次预估扣减——
 * 流结束再按真实 usage 记账，允许小幅溢出（换来实现简单，且不会因一次长对话把用户彻底锁死）。
 */
export async function checkQuota(subject: string): Promise<QuotaDecision> {
  const plan = await readPlan(subject)
  const used = await readTodayUsage(subject)
  const resetAt = nextUtcMidnightIso()

  if (used.requests >= SPONSORED_DAILY_REQUESTS) {
    return {
      allowed: false,
      plan,
      reason: "REQUEST_LIMIT",
      used,
      resetAt,
      dailyTokens: SPONSORED_DAILY_TOKENS,
      dailyRequests: SPONSORED_DAILY_REQUESTS,
    }
  }
  if (used.tokens >= SPONSORED_DAILY_TOKENS) {
    return {
      allowed: false,
      plan,
      reason: "TOKEN_LIMIT",
      used,
      resetAt,
      dailyTokens: SPONSORED_DAILY_TOKENS,
      dailyRequests: SPONSORED_DAILY_REQUESTS,
    }
  }
  return {
    allowed: true,
    plan,
    used,
    resetAt,
    dailyTokens: SPONSORED_DAILY_TOKENS,
    dailyRequests: SPONSORED_DAILY_REQUESTS,
  }
}

/** 流结束后按真实 usage 记账（幂等累加；失败不影响响应） */
export async function consumeQuota(
  subject: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  if (!isDatabaseConfigured() || !subject) return
  await query(
    `INSERT INTO usage_daily (subject, day, requests, input_tokens, output_tokens)
     VALUES ($1, (now() AT TIME ZONE 'UTC')::date, 1, $2, $3)
     ON CONFLICT (subject, day) DO UPDATE SET
       requests      = usage_daily.requests + 1,
       input_tokens  = usage_daily.input_tokens  + EXCLUDED.input_tokens,
       output_tokens = usage_daily.output_tokens + EXCLUDED.output_tokens,
       updated_at    = now()`,
    [subject, Math.max(0, Math.round(inputTokens)), Math.max(0, Math.round(outputTokens))],
  )
}
