import "server-only"

import { isDatabaseConfigured, query } from "./postgres"
import {
  nextUtcMidnightIso,
  resolvePlan,
  type PlanDefinition,
} from "@/lib/compute/plans"

/**
 * 权益判定 + 免费模型额度的每日计量（UTC 自然日窗口）。
 * 表见 db/migrations/005_entitlements_and_quota.sql。
 *
 * 设计要点：
 * - 计量对象是「走我们 Gateway 的免费模型」；BYOK 直连不经服务端，不计量也不限流。
 * - DB 不可用时**fail-open**（按 free 档放行并记日志）：免费模型边际成本≈0，
 *   宁可短时少记账，也不要因为账本抖动把产品打挂。真正的熔断靠 FREE_MODELS_ENABLED 开关。
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
 * 只做「已用 vs 上限」的粗校验，不做单次预估扣减——流结束再按真实 usage 记账，
 * 允许小幅溢出（换来实现简单，且不会因一次长对话把用户彻底锁死）。
 */
export async function checkQuota(subject: string): Promise<QuotaDecision> {
  const plan = await readPlan(subject)
  const used = await readTodayUsage(subject)
  const resetAt = nextUtcMidnightIso()

  if (used.requests >= plan.quota.dailyRequests) {
    return { allowed: false, plan, reason: "REQUEST_LIMIT", used, resetAt }
  }
  if (used.tokens >= plan.quota.dailyTokens) {
    return { allowed: false, plan, reason: "TOKEN_LIMIT", used, resetAt }
  }
  return { allowed: true, plan, used, resetAt }
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
