import "server-only"

import { isDatabaseConfigured, query, transaction } from "@/lib/neon/postgres"
import {
  AGENT_GRANT_VALIDITY_DAYS,
  AGENT_TOKEN_BUDGET_USD,
  openModeRequestCap,
} from "@/lib/agents/billing-config"

/**
 * 按次付费的 Agent 服务：授权与用量账本。
 *
 * 两张表（迁移 015）：
 *  - agent_service_grants：用户手里的服务授权。来源订单号只是幂等键，
 *    不再绑定某一家收款商。30 天有效，token 价值上限 10 美元，用满即 exhausted。
 *  - agent_usage_ledger：逐次推理的计量明细，可审计、可对账。
 *
 * 幂等约定：
 *  - grantForPaidOrder 用 source_order_id 唯一约束拦截重复发放；
 *  - recordInferenceUsage 先插明细再累加授权，两步在同一事务里；
 *  - consumeGrant 累加时带上「未超上限」条件，超了就直接置 exhausted。
 *
 * 诚实纪律：cost_usd 拿不到单价时存 NULL，**不写 0**（0 会被读成「这次没花钱」）。
 */

export type GrantStatus = "active" | "exhausted" | "expired" | "refunded"

export interface AgentGrant {
  id: string
  subject: string
  sourceOrderId: string
  status: GrantStatus
  grantedAt: string
  expiresAt: string
  tokenBudgetUsd: number
  tokenUsedUsd: number
}

export interface GrantState {
  /** 当前可用的授权（未过期、未耗尽） */
  grant: AgentGrant | null
  /** 全部授权（含已用尽的），按发放时间倒序 */
  grants: AgentGrant[]
  /** 可用授权的剩余 token 价值（USD） */
  remainingUsd: number
  /** 有效授权还剩多少天（null = 没有有效授权） */
  validDaysLeft: number | null
}

interface GrantRow {
  id: string
  subject: string
  source_order_id: string
  status: string
  granted_at: Date
  expires_at: Date
  token_budget_usd: string | number
  token_used_usd: string | number
}

function toGrant(row: GrantRow): AgentGrant {
  return {
    id: row.id,
    subject: row.subject,
    sourceOrderId: row.source_order_id,
    status: (row.status as GrantStatus) ?? "active",
    grantedAt: row.granted_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    tokenBudgetUsd: Number(row.token_budget_usd ?? 0),
    tokenUsedUsd: Number(row.token_used_usd ?? 0),
  }
}

const GRANT_SELECT = `
  SELECT id, subject, source_order_id, status, granted_at, expires_at,
         token_budget_usd, token_used_usd
    FROM agent_service_grants`

/**
 * 订单核销为 paid 时发放授权。同一订单重复回调不会发第二份。
 * @returns 授权 id；本次没有新建（已存在）时返回既有 id。
 */
export async function grantForPaidOrder(input: {
  subject: string
  orderId: string
  priceUsd?: number
}): Promise<string | null> {
  if (!isDatabaseConfigured() || !input.subject || !input.orderId) return null
  const id = `grant_${input.orderId}`
  try {
    const { rows } = await query<{ id: string }>(
      `INSERT INTO agent_service_grants
         (id, subject, source_order_id, status, expires_at, token_budget_usd)
       VALUES ($1, $2, $3, 'active',
               now() + ($4 || ' days')::interval,
               $5)
       ON CONFLICT (source_order_id) DO NOTHING
       RETURNING id`,
      [
        id,
        input.subject,
        input.orderId,
        String(AGENT_GRANT_VALIDITY_DAYS),
        AGENT_TOKEN_BUDGET_USD,
      ],
    )
    if (rows[0]) return rows[0].id
    // 已存在（重复回调）：取回原授权
    const existing = await query<{ id: string }>(
      `SELECT id FROM agent_service_grants WHERE source_order_id = $1 LIMIT 1`,
      [input.orderId],
    )
    return existing.rows[0]?.id ?? null
  } catch (error) {
    console.error("[billing] 发放授权失败:", error)
    return null
  }
}

/** 退款：把这份授权作废（只对还没耗尽的生效，状态如实记录） */
export async function revokeGrantForOrder(orderId: string): Promise<boolean> {
  if (!isDatabaseConfigured() || !orderId) return false
  try {
    const { rowCount } = await query(
      `UPDATE agent_service_grants
          SET status = 'refunded', updated_at = now()
        WHERE source_order_id = $1 AND status = 'active'`,
      [orderId],
    )
    return (rowCount ?? 0) > 0
  } catch (error) {
    console.error("[billing] 作废授权失败:", error)
    return false
  }
}

/** 用户的全部授权（发放时间倒序） */
export async function listGrants(subject: string, limit = 20): Promise<AgentGrant[]> {
  if (!isDatabaseConfigured() || !subject) return []
  try {
    const { rows } = await query<GrantRow>(
      `${GRANT_SELECT} WHERE subject = $1 ORDER BY granted_at DESC LIMIT $2`,
      [subject, limit],
    )
    return rows.map(toGrant)
  } catch (error) {
    console.error("[billing] 读取授权列表失败:", error)
    return []
  }
}

/**
 * 当前可用授权：active、未过期、额度未用尽。
 * 过期的不在这里面 —— 过期即失效，不做「过期也能用」的宽容处理。
 */
export async function findUsableGrant(subject: string): Promise<AgentGrant | null> {
  if (!isDatabaseConfigured() || !subject) return null
  try {
    const { rows } = await query<GrantRow>(
      `${GRANT_SELECT}
        WHERE subject = $1
          AND status = 'active'
          AND expires_at > now()
          AND token_used_usd < token_budget_usd
        ORDER BY granted_at ASC
        LIMIT 1`,
      [subject],
    )
    return rows[0] ? toGrant(rows[0]) : null
  } catch (error) {
    console.error("[billing] 读取可用授权失败:", error)
    return null
  }
}

/** 把会话绑到某份授权（计量时据此扣减） */
export async function attachGrantToSession(input: {
  sessionId: string
  subject: string
  grantId: string
}): Promise<void> {
  if (!isDatabaseConfigured()) return
  try {
    await query(
      `UPDATE chat_sessions SET grant_id = $3 WHERE id = $1 AND subject = $2`,
      [input.sessionId, input.subject, input.grantId],
    )
  } catch (error) {
    console.error("[billing] 绑定授权到会话失败:", error)
  }
}

/** 查会话绑定的授权（按 subject 校验，防止跨用户拿额度） */
export async function grantForSession(
  sessionId: string,
  subject: string,
): Promise<AgentGrant | null> {
  if (!isDatabaseConfigured() || !sessionId || !subject) return null
  try {
    const { rows } = await query<GrantRow>(
      `${GRANT_SELECT}
        WHERE id = (SELECT grant_id FROM chat_sessions WHERE id = $1 AND subject = $2)`,
      [sessionId, subject],
    )
    return rows[0] ? toGrant(rows[0]) : null
  } catch (error) {
    console.error("[billing] 读取会话授权失败:", error)
    return null
  }
}

export interface UsageRecord {
  subject: string
  grantId: string | null
  sessionId: string | null
  model: string | null
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  /** 拿不到单价时为 null */
  costUsd: number | null
  source?: string
  requestId?: string | null
  /** 拿不到耗时就留空，不写 0 */
  latencyMs?: number | null
  /** 拿不到状态就留空，不写成 success */
  status?: string | null
}

/**
 * 记一次推理的用量，并累加授权额度（超上限则把授权置为 exhausted）。
 *
 * 用事务保证「明细 + 累加」要么都成功要么都不成功，避免账本和额度对不上。
 */
export async function recordInferenceUsage(record: UsageRecord): Promise<void> {
  if (!isDatabaseConfigured() || !record.subject) return
  try {
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO agent_usage_ledger
           (subject, grant_id, session_id, model, input_tokens, output_tokens,
            cache_read_tokens, cost_usd, source, request_id, latency_ms, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          record.subject,
          record.grantId,
          record.sessionId,
          record.model,
          Math.max(0, Math.round(record.inputTokens)),
          Math.max(0, Math.round(record.outputTokens)),
          Math.max(0, Math.round(record.cacheReadTokens)),
          record.costUsd,
          record.source ?? "chat",
          record.requestId ?? null,
          record.latencyMs ?? null,
          record.status ?? null,
        ],
      )
      if (!record.grantId || record.costUsd === null) return
      // 累加：只有在「累加后仍未超上限」时才更新；超了就把状态置 exhausted
      await client.query(
        `UPDATE agent_service_grants
            SET token_used_usd = token_used_usd + $3,
                status = CASE
                           WHEN token_used_usd + $3 >= token_budget_usd THEN 'exhausted'
                           ELSE status
                         END,
                updated_at = now()
          WHERE id = $1 AND subject = $2 AND status = 'active'`,
        [record.grantId, record.subject, record.costUsd],
      )
    })
  } catch (error) {
    console.error("[billing] 记录用量失败:", error)
  }
}

/** 把过期的 active 授权标记为 expired（读取时顺带做，保持状态真实） */
export async function expireStaleGrants(subject?: string): Promise<void> {
  if (!isDatabaseConfigured()) return
  try {
    await query(
      `UPDATE agent_service_grants
          SET status = 'expired', updated_at = now()
        WHERE status = 'active' AND expires_at <= now()
          AND ($1::text IS NULL OR subject = $1)`,
      [subject ?? null],
    )
  } catch (error) {
    console.error("[billing] 标记过期授权失败:", error)
  }
}

/** 前端展示用：当前额度状态 */
export async function readGrantState(subject: string): Promise<GrantState> {
  const grants = await listGrants(subject)
  await expireStaleGrants(subject)
  const fresh = await listGrants(subject)
  const usable = fresh.find(
    (g) =>
      g.status === "active" &&
      new Date(g.expiresAt).getTime() > Date.now() &&
      g.tokenUsedUsd < g.tokenBudgetUsd,
  )
  const remainingUsd = usable
    ? Math.max(0, Number((usable.tokenBudgetUsd - usable.tokenUsedUsd).toFixed(6)))
    : 0
  const validDaysLeft = usable
    ? Math.max(
        0,
        Math.ceil((new Date(usable.expiresAt).getTime() - Date.now()) / (24 * 3600 * 1000)),
      )
    : null
  return {
    grant: usable ?? null,
    grants: grants.length ? grants : fresh,
    remainingUsd,
    validDaysLeft,
  }
}

export interface OpenModeBudget {
  requests: number
  knownCostUsd: number | null
  blocked: boolean
  reason: "ok" | "cost_cap" | "request_cap" | "unavailable"
}

/**
 * 开放测试模式的 24 小时预算。
 * 已知成本达到授权上限，或请求次数达到次数护栏，就停。
 * 查不到账本时拒绝放行（unavailable），避免预算表故障变成无限调用。
 * 成本为 NULL 的行不计入金额，也不被当成 0 美元。
 */
export async function readOpenModeBudget(subject: string): Promise<OpenModeBudget> {
  const empty: OpenModeBudget = {
    requests: 0,
    knownCostUsd: null,
    blocked: false,
    reason: "ok",
  }
  if (!subject) return { ...empty, blocked: true, reason: "unavailable" }
  if (!isDatabaseConfigured()) return { ...empty, blocked: true, reason: "unavailable" }
  try {
    const { rows } = await query<{ requests: string; cost_usd: string | null }>(
      `SELECT COUNT(*)::text AS requests,
              SUM(cost_usd)::text AS cost_usd
         FROM agent_usage_ledger
        WHERE subject = $1
          AND created_at > now() - interval '24 hours'`,
      [subject],
    )
    const requests = Number(rows[0]?.requests ?? 0)
    const rawCost = rows[0]?.cost_usd
    const knownCostUsd =
      rawCost === null || rawCost === undefined || !Number.isFinite(Number(rawCost))
        ? null
        : Number(rawCost)
    if (knownCostUsd !== null && knownCostUsd >= AGENT_TOKEN_BUDGET_USD) {
      return { requests, knownCostUsd, blocked: true, reason: "cost_cap" }
    }
    if (requests >= openModeRequestCap()) {
      return { requests, knownCostUsd, blocked: true, reason: "request_cap" }
    }
    return { requests, knownCostUsd, blocked: false, reason: "ok" }
  } catch (error) {
    console.error("[billing] 读取测试预算失败:", error instanceof Error ? error.name : "error")
    return { requests: 0, knownCostUsd: null, blocked: true, reason: "unavailable" }
  }
}

export interface AgentUsageRow {
  id: string
  model: string | null
  inputTokens: number
  outputTokens: number
  costUsd: number | null
  status: string | null
  latencyMs: number | null
  requestId: string | null
  sessionId: string | null
  createdAt: string
}

/** 账单页：这个主体自己的推理明细。没有记录就返回空数组，不补示例行。 */
export async function listAgentUsage(subject: string, limit = 20): Promise<AgentUsageRow[]> {
  if (!isDatabaseConfigured() || !subject) return []
  try {
    const { rows } = await query<{
      id: string
      model: string | null
      input_tokens: number
      output_tokens: number
      cost_usd: string | null
      status: string | null
      latency_ms: number | null
      request_id: string | null
      session_id: string | null
      created_at: Date
    }>(
      `SELECT id::text, model, input_tokens, output_tokens, cost_usd::text,
              status, latency_ms, request_id, session_id, created_at
         FROM agent_usage_ledger
        WHERE subject = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [subject, limit],
    )
    return rows.map((row) => ({
      id: row.id,
      model: row.model,
      inputTokens: Number(row.input_tokens ?? 0),
      outputTokens: Number(row.output_tokens ?? 0),
      costUsd: row.cost_usd === null ? null : Number(row.cost_usd),
      status: row.status,
      latencyMs: row.latency_ms,
      requestId: row.request_id,
      sessionId: row.session_id,
      createdAt: row.created_at.toISOString(),
    }))
  } catch (error) {
    console.error("[billing] 读取用量明细失败:", error instanceof Error ? error.name : "error")
    return []
  }
}

export interface UsageSummary {
  requests: number
  inputTokens: number
  outputTokens: number
  costUsd: number | null
}

/** 用量汇总（账单页/控制台）：costUsd 只累加有单价的那部分，其余如实忽略 */
export async function summarizeUsage(subject: string): Promise<UsageSummary> {
  const empty: UsageSummary = { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: null }
  if (!isDatabaseConfigured() || !subject) return empty
  try {
    const { rows } = await query<{
      requests: string
      input_tokens: string
      output_tokens: string
      cost_usd: string | null
    }>(
      `SELECT COUNT(*)::text AS requests,
              COALESCE(SUM(input_tokens), 0)::text AS input_tokens,
              COALESCE(SUM(output_tokens), 0)::text AS output_tokens,
              SUM(cost_usd)::text AS cost_usd
         FROM agent_usage_ledger
        WHERE subject = $1`,
      [subject],
    )
    const row = rows[0]
    if (!row) return empty
    const cost = row.cost_usd === null ? null : Number(row.cost_usd)
    return {
      requests: Number(row.requests ?? 0),
      inputTokens: Number(row.input_tokens ?? 0),
      outputTokens: Number(row.output_tokens ?? 0),
      costUsd: cost !== null && Number.isFinite(cost) ? cost : null,
    }
  } catch (error) {
    console.error("[billing] 汇总用量失败:", error)
    return empty
  }
}
