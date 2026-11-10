import "server-only"

import { isDatabaseConfigured, query, transaction } from "@/lib/neon/postgres"
import type { TargetType } from "@/lib/research/types"
import {
  constraintsAccepted,
  listConnectedReadTools,
  type ProfileInput,
  type ProfileSnapshot,
  type ResearchRunView,
  type SavedProfile,
  type StoredResearchReport,
} from "@/lib/agents/rwa-research"

interface ProfileRow {
  model_mode: "sponsored" | "byok"
  sponsored_model_slug: string | null
  byok_connection_id: string | null
  byok_model_label: string | null
  allowed_tool_ids: string[]
  constraint_read_only: boolean
  constraint_cite_sources: boolean
  constraint_unverified_not_fact: boolean
  updated_at: Date
}

interface RunRow {
  order_id: string
  execution_id: string
  task_text: string
  target: string
  target_type: TargetType
  created_at: Date
  finished_at: Date | null
  status: "running" | "succeeded" | "failed"
  channel: string
  geo_tier: string | null
  payment_status: string
  settlement: string
  list_price_usd: string | null
  price_currency: string
  report: StoredResearchReport | null
  narrative: string | null
  narrative_source: "none" | "sponsored" | "byok_browser" | null
  narrative_note: string | null
  error_message: string | null
  profile_snapshot: ProfileSnapshot
}

function toProfile(row: ProfileRow): SavedProfile {
  const allowedToolIds = row.allowed_tool_ids ?? []
  const excludedToolIds = listConnectedReadTools()
    .map((tool) => tool.id)
    .filter((id) => !allowedToolIds.includes(id))
  return {
    modelMode: row.model_mode,
    sponsoredModelSlug: row.sponsored_model_slug,
    byokConnectionId: row.byok_connection_id,
    byokModelLabel: row.byok_model_label,
    allowedToolIds,
    constraints: {
      readOnly: row.constraint_read_only,
      citeSources: row.constraint_cite_sources,
      unverifiedNotFact: row.constraint_unverified_not_fact,
    },
    excludedToolIds,
    updatedAt: row.updated_at.toISOString(),
  }
}

function toRun(row: RunRow): ResearchRunView {
  return {
    orderId: row.order_id,
    executionId: row.execution_id,
    taskText: row.task_text,
    target: row.target,
    targetType: row.target_type,
    createdAt: row.created_at.toISOString(),
    finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
    status: row.status,
    channel: row.channel,
    geoTier: row.geo_tier,
    paymentStatus: "unpaid",
    settlement: "not_wired",
    listPriceUsd: null,
    priceCurrency: "USD",
    report: row.report,
    narrative: row.narrative,
    narrativeSource: row.narrative_source,
    narrativeNote: row.narrative_note,
    errorMessage: row.error_message,
    profileSnapshot: row.profile_snapshot,
  }
}

const RUN_SELECT = `
  SELECT o.id AS order_id,
         e.id AS execution_id,
         o.task_text,
         o.target,
         o.target_type,
         o.created_at,
         e.finished_at,
         e.status,
         o.channel,
         o.geo_tier,
         o.payment_status,
         o.settlement,
         o.list_price_usd,
         o.price_currency,
         e.report,
         e.narrative,
         e.narrative_source,
         e.narrative_note,
         e.error_message,
         e.profile_snapshot
    FROM rwa_research_orders o
    JOIN rwa_research_executions e
      ON e.order_id = o.id
     AND e.subject = o.subject
`

export async function getRwaProfile(subject: string): Promise<SavedProfile | null> {
  if (!isDatabaseConfigured() || !subject) return null
  const { rows } = await query<ProfileRow>(
    `SELECT model_mode, sponsored_model_slug, byok_connection_id, byok_model_label,
            allowed_tool_ids, constraint_read_only, constraint_cite_sources,
            constraint_unverified_not_fact, updated_at
       FROM rwa_research_profiles
      WHERE subject = $1`,
    [subject],
  )
  const row = rows[0]
  if (!row) return null
  const profile = toProfile(row)
  if (!constraintsAccepted(profile.constraints)) return null
  return profile
}

export async function saveRwaProfile(subject: string, input: ProfileInput): Promise<SavedProfile> {
  const { rows } = await query<ProfileRow>(
    `INSERT INTO rwa_research_profiles (
       subject, model_mode, sponsored_model_slug, byok_connection_id, byok_model_label,
       allowed_tool_ids, constraint_read_only, constraint_cite_sources,
       constraint_unverified_not_fact, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6::text[],$7,$8,$9, now())
     ON CONFLICT (subject) DO UPDATE SET
       model_mode = EXCLUDED.model_mode,
       sponsored_model_slug = EXCLUDED.sponsored_model_slug,
       byok_connection_id = EXCLUDED.byok_connection_id,
       byok_model_label = EXCLUDED.byok_model_label,
       allowed_tool_ids = EXCLUDED.allowed_tool_ids,
       constraint_read_only = EXCLUDED.constraint_read_only,
       constraint_cite_sources = EXCLUDED.constraint_cite_sources,
       constraint_unverified_not_fact = EXCLUDED.constraint_unverified_not_fact,
       updated_at = now()
     RETURNING model_mode, sponsored_model_slug, byok_connection_id, byok_model_label,
               allowed_tool_ids, constraint_read_only, constraint_cite_sources,
               constraint_unverified_not_fact, updated_at`,
    [
      subject,
      input.modelMode,
      input.sponsoredModelSlug,
      input.byokConnectionId,
      input.byokModelLabel,
      input.allowedToolIds,
      input.constraints.readOnly,
      input.constraints.citeSources,
      input.constraints.unverifiedNotFact,
    ],
  )
  return toProfile(rows[0])
}

export async function insertRwaRun(input: {
  subject: string
  taskText: string
  target: string
  targetType: TargetType
  geoTier: string | null
  channel: string
  snapshot: ProfileSnapshot
}): Promise<{ orderId: string; executionId: string }> {
  return transaction(async (client) => {
    const order = await client.query<{ id: string }>(
      `INSERT INTO rwa_research_orders (
         subject, task_text, target, target_type, list_price_usd, price_currency,
         payment_status, settlement, geo_tier, channel
       ) VALUES ($1,$2,$3,$4,NULL,'USD','unpaid','not_wired',$5,$6)
       RETURNING id`,
      [
        input.subject,
        input.taskText,
        input.target,
        input.targetType,
        input.geoTier,
        input.channel,
      ],
    )
    const orderId = order.rows[0]?.id
    if (!orderId) throw new Error("订单没有写上")
    const execution = await client.query<{ id: string }>(
      `INSERT INTO rwa_research_executions (
         subject, order_id, profile_snapshot, status, narrative_source
       ) VALUES ($1,$2,$3::jsonb,'running','none')
       RETURNING id`,
      [input.subject, orderId, JSON.stringify(input.snapshot)],
    )
    const executionId = execution.rows[0]?.id
    if (!executionId) throw new Error("执行记录没有写上")
    return { orderId, executionId }
  })
}

export async function finishRwaRun(input: {
  subject: string
  executionId: string
  status: "succeeded" | "failed"
  report: StoredResearchReport | null
  narrative: string | null
  narrativeSource: "none" | "sponsored" | "byok_browser"
  narrativeNote: string | null
  errorMessage: string | null
}): Promise<void> {
  await query(
    `UPDATE rwa_research_executions
        SET status = $3,
            report = $4::jsonb,
            narrative = $5,
            narrative_source = $6,
            narrative_note = $7,
            error_message = $8,
            finished_at = now()
      WHERE id = $1 AND subject = $2`,
    [
      input.executionId,
      input.subject,
      input.status,
      input.report ? JSON.stringify(input.report) : null,
      input.narrative,
      input.narrativeSource,
      input.narrativeNote,
      input.errorMessage,
    ],
  )
}

export async function listRwaRuns(subject: string, limit = 20): Promise<ResearchRunView[]> {
  if (!isDatabaseConfigured() || !subject) return []
  const { rows } = await query<RunRow>(
    `${RUN_SELECT}
      WHERE o.subject = $1 AND e.subject = $1
      ORDER BY o.created_at DESC
      LIMIT $2`,
    [subject, limit],
  )
  return rows.map(toRun)
}

export async function getRwaRun(subject: string, orderId: string): Promise<ResearchRunView | null> {
  if (!isDatabaseConfigured() || !subject) return null
  const { rows } = await query<RunRow>(
    `${RUN_SELECT}
      WHERE o.id = $1 AND o.subject = $2 AND e.subject = $2`,
    [orderId, subject],
  )
  return rows[0] ? toRun(rows[0]) : null
}

export async function attachBrowserNarrative(input: {
  subject: string
  orderId: string
  narrative: string
}): Promise<ResearchRunView | null> {
  const updated = await query(
    `UPDATE rwa_research_executions e
        SET narrative = $3,
            narrative_source = 'byok_browser',
            narrative_note = $4
       FROM rwa_research_orders o
      WHERE e.order_id = o.id
        AND o.id = $1
        AND e.subject = $2
        AND o.subject = $2
        AND e.status = 'succeeded'
        AND e.profile_snapshot->>'modelMode' = 'byok'
        AND e.narrative_source IS DISTINCT FROM 'sponsored'`,
    [
      input.orderId,
      input.subject,
      input.narrative,
      "这段文字由浏览器里的模型整理，密钥没有上传。它不是新的链上事实，事实以报告中的来源为准。",
    ],
  )
  if (updated.rowCount === 0) return null
  return getRwaRun(input.subject, input.orderId)
}
