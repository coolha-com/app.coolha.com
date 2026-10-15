import "server-only"

import { isDatabaseConfigured, query } from "./postgres"
import {
  AMOUNT_FINGERPRINT_CENTS,
  ORDER_WINDOW_MINUTES,
  SUBSCRIPTION_PERIOD_DAYS,
  centsToRawUnits,
  rawUnitsToAmount,
  type ChainKey,
  type TokenSymbol,
} from "@/lib/subscription/config"
import { PLANS, type PlanId } from "@/lib/compute/plans"

/**
 * 链上订阅：下单 → 匹配转账 → 授予权益 → 记账。
 * 表见 db/migrations/007_subscription_orders.sql。
 *
 * 匹配法（无托管、无私钥）：用户转「精确金额（含指纹尾数）」到收款地址，
 * 按 (chain, token, amount_raw, 未过期 pending) 命中订单；同分时优先 from == 登录地址。
 */

export class SubscriptionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = "SubscriptionError"
  }
}

export interface SubscriptionOrder {
  id: string
  plan: string
  chain: string
  token: string
  tokenAddress: string
  payTo: string
  amountToken: string
  amountRaw: string
  status: string
  expiresAt: string
  paidAt: string | null
  createdAt: string
}

interface OrderRow {
  id: string
  plan: string
  chain: string
  token: string
  token_address: string
  pay_to: string
  amount_token: string
  amount_raw: string
  status: string
  expires_at: Date
  paid_at: Date | null
  created_at: Date
}

function toOrder(row: OrderRow): SubscriptionOrder {
  return {
    id: row.id,
    plan: row.plan,
    chain: row.chain,
    token: row.token,
    tokenAddress: row.token_address,
    payTo: row.pay_to,
    amountToken: row.amount_token,
    amountRaw: row.amount_raw,
    status: row.status,
    expiresAt: row.expires_at.toISOString(),
    paidAt: row.paid_at ? row.paid_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  }
}

/** 收款地址：部署前必须配置（建议用与身份无关的多签/专用地址） */
export function getTreasuryAddress(): string {
  return (process.env.SUBSCRIPTION_TREASURY_ADDRESS ?? "").trim()
}

export interface CreateOrderInput {
  subject: string
  walletAddress: string
  plan: PlanId
  chain: ChainKey
  token: TokenSymbol
  tokenAddress: string
  decimals: number
  geo_tier?: string | null
}

export async function createSubscriptionOrder(
  input: CreateOrderInput,
): Promise<SubscriptionOrder> {
  if (!isDatabaseConfigured()) {
    throw new SubscriptionError("DB_NOT_CONFIGURED", "数据库未配置，无法创建订单")
  }
  const treasury = getTreasuryAddress()
  if (!treasury) {
    throw new SubscriptionError(
      "TREASURY_NOT_CONFIGURED",
      "收款地址未配置（SUBSCRIPTION_TREASURY_ADDRESS）",
    )
  }
  const plan = PLANS[input.plan]
  if (!plan || plan.priceUsd <= 0) {
    throw new SubscriptionError("INVALID_PLAN", "该档位不参与链上订阅")
  }
  // 合规：地理屏蔽地区不得通过链上支付绕过 proxy.ts 的拦截
  if (input.geo_tier === "hard-block") {
    throw new SubscriptionError("REGION_BLOCKED", "当前地区不支持订阅")
  }

  // 金额指纹：0~9 分尾数，降低同档位订单的匹配歧义
  const fingerprint = Math.floor(Math.random() * AMOUNT_FINGERPRINT_CENTS)
  const amountCents = Math.round(plan.priceUsd * 100) + fingerprint
  const amountRaw = centsToRawUnits(amountCents, input.decimals)
  const amountToken = rawUnitsToAmount(amountRaw, input.decimals)

  const { rows } = await query<OrderRow>(
    `INSERT INTO subscription_orders (
       subject, wallet_address, plan, chain, token, token_address, pay_to,
       amount_cents, amount_token, amount_raw, geo_tier, period_days, expires_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now() + ($13 || ' minutes')::interval)
     RETURNING id, plan, chain, token, token_address, pay_to, amount_token, amount_raw,
               status, expires_at, paid_at, created_at`,
    [
      input.subject,
      input.walletAddress.toLowerCase(),
      input.plan,
      input.chain,
      input.token,
      input.tokenAddress.toLowerCase(),
      treasury.toLowerCase(),
      amountCents,
      amountToken,
      amountRaw.toString(),
      input.geo_tier ?? null,
      SUBSCRIPTION_PERIOD_DAYS,
      String(ORDER_WINDOW_MINUTES),
    ],
  )
  return toOrder(rows[0])
}

export async function getSubscriptionOrder(
  id: string,
  subject: string,
): Promise<SubscriptionOrder | null> {
  if (!isDatabaseConfigured()) return null
  const { rows } = await query<OrderRow>(
    `SELECT id, plan, chain, token, token_address, pay_to, amount_token, amount_raw,
            status, expires_at, paid_at, created_at
       FROM subscription_orders
      WHERE id = $1 AND subject = $2`,
    [id, subject],
  )
  return rows[0] ? toOrder(rows[0]) : null
}

export async function listSubscriptionOrders(subject: string, limit = 20) {
  if (!isDatabaseConfigured()) return []
  const { rows } = await query<OrderRow>(
    `SELECT id, plan, chain, token, token_address, pay_to, amount_token, amount_raw,
            status, expires_at, paid_at, created_at
       FROM subscription_orders
      WHERE subject = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [subject, limit],
  )
  return rows.map(toOrder)
}

export interface LedgerRow {
  id: string
  kind: string
  amountUsd: string
  plan: string | null
  memo: string | null
  createdAt: string
}

export async function listLedger(subject: string, limit = 20): Promise<LedgerRow[]> {
  if (!isDatabaseConfigured()) return []
  const { rows } = await query<{
    id: string
    kind: string
    amount_usd: string
    plan: string | null
    memo: string | null
    created_at: Date
  }>(
    `SELECT id, kind, amount_usd, plan, memo, created_at
       FROM compute_ledger
      WHERE subject = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [subject, limit],
  )
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    amountUsd: row.amount_usd,
    plan: row.plan,
    memo: row.memo,
    createdAt: row.created_at.toISOString(),
  }))
}

/** 授予（或续期）档位；同一用户重复购买按 max(现有到期, now) 顺延 */
export async function grantPlan(
  subject: string,
  plan: PlanId,
  source: "crypto" | "token_gate" | "manual",
  periodDays: number,
): Promise<void> {
  await query(
    `INSERT INTO entitlements (subject, plan, status, source, period_end, updated_at)
     VALUES ($1, $2, 'active', $3, now() + make_interval(days => $4::int), now())
     ON CONFLICT (subject) DO UPDATE SET
       plan       = EXCLUDED.plan,
       status     = 'active',
       source     = EXCLUDED.source,
       period_end = GREATEST(COALESCE(entitlements.period_end, now()), now())
                    + make_interval(days => $4::int),
       updated_at = now()`,
    [subject, plan, source, periodDays],
  )
}

export interface ObservedTransfer {
  chain: ChainKey
  token: TokenSymbol
  from: string
  raw: bigint
  txHash: string
  logIndex: number
}

export interface MatchResult {
  status: "granted" | "not_found" | "already_processed"
  plan?: PlanId
  subject?: string
  orderId?: string
}

/**
 * 用一笔观测到的转账尝试结算某个 pending 订单。
 * 命中条件：chain + token + amount_raw 完全一致且订单未过期；同分时优先 from == 登录地址。
 * 幂等：tx_hash + log_index 唯一；重复回调返回 already_processed。
 */
export async function settleWithTransfer(
  transfer: ObservedTransfer,
): Promise<MatchResult> {
  if (!isDatabaseConfigured()) return { status: "not_found" }

  const { rows } = await query<{
    id: string
    subject: string
    plan: string
    period_days: number
    amount_cents: number
  }>(
    `SELECT id, subject, plan, period_days, amount_cents
       FROM subscription_orders
      WHERE status = 'pending'
        AND chain = $1 AND token = $2 AND amount_raw = $3::numeric
        AND expires_at > now()
      ORDER BY (lower(wallet_address) = lower($4)) DESC, created_at ASC
      LIMIT 1`,
    [transfer.chain, transfer.token, transfer.raw.toString(), transfer.from.toLowerCase()],
  )
  const candidate = rows[0]
  if (!candidate) return { status: "not_found" }

  // 占位：status 仍为 pending 才允许更新，避免并发重复授予
  const claimed = await query(
    `UPDATE subscription_orders
        SET status = 'paid', tx_hash = $2, log_index = $3, from_address = $4, paid_at = now()
      WHERE id = $1 AND status = 'pending'`,
    [candidate.id, transfer.txHash.toLowerCase(), transfer.logIndex, transfer.from.toLowerCase()],
  )
  if (claimed.rowCount === 0) return { status: "already_processed" }

  try {
    await grantPlan(candidate.subject, candidate.plan as PlanId, "crypto", candidate.period_days)
    await query(
      `INSERT INTO compute_ledger (subject, kind, amount_usd, plan, memo, ref_order_id)
       VALUES ($1, 'subscription', $2, $3, $4, $5)`,
      [
        candidate.subject,
        (candidate.amount_cents / 100).toFixed(6),
        candidate.plan,
        `${transfer.chain}/${transfer.token} ${transfer.txHash}`,
        candidate.id,
      ],
    )
  } catch (error) {
    console.error("[subscription] 授予权益失败（款项已入账，需人工补授）:", error)
  }

  return {
    status: "granted",
    plan: candidate.plan as PlanId,
    subject: candidate.subject,
    orderId: candidate.id,
  }
}

/** 超时未支付的订单标记为 expired（由 cron 或下单时顺带清理） */
export async function expireStaleOrders(): Promise<number> {
  if (!isDatabaseConfigured()) return 0
  const result = await query(
    `UPDATE subscription_orders
        SET status = 'expired'
      WHERE status = 'pending' AND expires_at < now()`,
  )
  return result.rowCount ?? 0
}

/** 未过期的 pending 订单（cron 扫描时用于判断是否值得扫链） */
export async function countPendingOrders(): Promise<number> {
  if (!isDatabaseConfigured()) return 0
  const { rows } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM subscription_orders
      WHERE status = 'pending' AND expires_at > now()`,
  )
  return Number(rows[0]?.count ?? 0)
}
