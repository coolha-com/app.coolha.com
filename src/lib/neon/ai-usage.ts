import { query, isDatabaseConfigured } from "./postgres"

/**
 * AI Gateway 真实调用用量记录（审计 + /ai/usage 展示）。
 * 表见 db/migrations/003_ai_gateway_usage.sql。
 *
 * 落库失败绝不影响推理响应——调用方需自行 catch。
 */

export interface UsageRecordInput {
  requestId: string
  generationId?: string | null
  modelId: string
  providerId?: string | null
  resolvedProvider?: string | null
  source?: string
  walletAddress?: string | null
  clientKey?: string | null
  inputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs: number
  status?: "success" | "error"
  errorCode?: string | null
}

export interface UsageRow {
  id: string
  request_id: string
  generation_id: string | null
  model_id: string
  provider_id: string | null
  resolved_provider: string | null
  source: string
  wallet_address: string | null
  input_tokens: number
  output_tokens: number
  total_tokens: number
  cost_usd: string
  latency_ms: number
  status: string
  error_code: string | null
  created_at: string
}

export async function recordUsage(input: UsageRecordInput): Promise<void> {
  if (!isDatabaseConfigured()) return

  await query(
    `INSERT INTO ai_gateway_usage (
       request_id, generation_id, model_id, provider_id, resolved_provider,
       source, wallet_address, client_key,
       input_tokens, output_tokens, total_tokens, cost_usd, latency_ms, status, error_code
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
     ON CONFLICT (request_id) DO NOTHING`,
    [
      input.requestId,
      input.generationId ?? null,
      input.modelId,
      input.providerId ?? null,
      input.resolvedProvider ?? null,
      input.source ?? "playground",
      input.walletAddress ?? null,
      input.clientKey ?? null,
      input.inputTokens,
      input.outputTokens,
      input.inputTokens + input.outputTokens,
      input.costUsd,
      input.latencyMs,
      input.status ?? "success",
      input.errorCode ?? null,
    ],
  )
}

/** 最近 N 条调用记录（/ai/usage 页面用） */
export async function listRecentUsage(limit = 50): Promise<UsageRow[]> {
  if (!isDatabaseConfigured()) return []
  const { rows } = await query<UsageRow>(
    `SELECT id, request_id, generation_id, model_id, provider_id, resolved_provider,
            source, wallet_address, input_tokens, output_tokens, total_tokens,
            cost_usd, latency_ms, status, error_code, created_at
     FROM ai_gateway_usage
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  )
  return rows
}

/** 汇总：总调用数 / 总 token / 总成本 */
export async function summarizeUsage(): Promise<{
  calls: number
  totalTokens: number
  totalCostUsd: number
}> {
  if (!isDatabaseConfigured()) return { calls: 0, totalTokens: 0, totalCostUsd: 0 }
  const { rows } = await query<{ calls: string; tokens: string | null; cost: string | null }>(
    `SELECT COUNT(*)::text AS calls,
            COALESCE(SUM(total_tokens), 0)::text AS tokens,
            COALESCE(SUM(cost_usd), 0)::text AS cost
     FROM ai_gateway_usage`,
  )
  const row = rows[0]
  return {
    calls: Number(row?.calls ?? 0),
    totalTokens: Number(row?.tokens ?? 0),
    totalCostUsd: Number(row?.cost ?? 0),
  }
}
