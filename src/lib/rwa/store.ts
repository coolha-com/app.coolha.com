import "server-only"

import { isDatabaseConfigured, query } from "@/lib/neon/postgres"
import type { ResearchReport, TokenObservation } from "@/lib/rwa/report"

export interface PersistResult {
  persisted: boolean
  note: string
}

function pgCode(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code
  }
  return null
}

export function assetIdOf(chainKey: string, address: string): string {
  return `asset_${chainKey}_${address.toLowerCase()}`
}

export async function persistTokenFacts(token: TokenObservation): Promise<PersistResult> {
  if (!isDatabaseConfigured()) {
    return { persisted: false, note: "数据库未配置，本次没有写入研究记录。" }
  }

  const assetId = assetIdOf(token.chainKey, token.address)
  const contractId = `ctr_${token.chainKey}_${token.address.toLowerCase()}`
  const sourceId = `src_${token.chainKey}_${token.address.toLowerCase()}_alchemy`

  try {
    await query(
      `INSERT INTO rwa_assets (id, name, symbol, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             symbol = EXCLUDED.symbol,
             updated_at = now()`,
      [assetId, token.name, token.symbol],
    )
    await query(
      `INSERT INTO rwa_asset_contracts
         (id, asset_id, chain_key, chain_id, address, read_status)
       VALUES ($1, $2, $3, $4, $5, 'rpc_read')
       ON CONFLICT (chain_key, address) DO UPDATE
         SET asset_id = EXCLUDED.asset_id,
             chain_id = EXCLUDED.chain_id,
             read_status = EXCLUDED.read_status`,
      [contractId, assetId, token.chainKey, token.chainId, token.address.toLowerCase()],
    )
    await query(
      `INSERT INTO rwa_asset_sources (id, asset_id, source_kind, label, note, fetched_at)
       VALUES ($1, $2, 'onchain_rpc', $3, $4, now())
       ON CONFLICT (id) DO UPDATE
         SET note = EXCLUDED.note,
             fetched_at = now()`,
      [
        sourceId,
        assetId,
        `Alchemy JSON-RPC ${token.endpoint}`,
        "只记录这次合约读取。不是发行方披露，也不是持有人索引。",
      ],
    )
    await query(
      `INSERT INTO rwa_asset_snapshots
         (asset_id, chain_key, address, block_number, payload, gaps)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
      [
        assetId,
        token.chainKey,
        token.address.toLowerCase(),
        token.blockNumber,
        JSON.stringify(token),
        JSON.stringify(token.unknown),
      ],
    )
    return {
      persisted: true,
      note: "本次读取已写入 rwa_assets / rwa_asset_contracts / rwa_asset_sources / rwa_asset_snapshots。付款状态保持 unpaid。",
    }
  } catch (error) {
    const code = pgCode(error)
    if (code === "42P01" || code === "42703") {
      return {
        persisted: false,
        note: "当前数据库没有这套研究表，本次没有写入。迁移只在 Neon dev 执行。",
      }
    }
    console.error("[rwa] 写入研究记录失败:", code ?? "error")
    return { persisted: false, note: "研究记录写入失败，链上读取结果仍然只来自这次 RPC。" }
  }
}

export async function persistReport(input: {
  token: TokenObservation
  report: ResearchReport
  subject: string | null
}): Promise<PersistResult> {
  try {
    await query(
      `INSERT INTO rwa_research_reports
         (id, subject, asset_id, chain_key, address, sections, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'unpaid')`,
      [
        `rpt_${crypto.randomUUID()}`,
        input.subject,
        assetIdOf(input.token.chainKey, input.token.address),
        input.token.chainKey,
        input.token.address.toLowerCase(),
        JSON.stringify(input.report.sections),
      ],
    )
    return { persisted: true, note: "研究报告已写入，付款状态为 unpaid。" }
  } catch (error) {
    const code = pgCode(error)
    console.error("[rwa] 写入报告失败:", code ?? "error")
    return { persisted: false, note: "合约快照已写入，研究报告行没有写入。" }
  }
}
