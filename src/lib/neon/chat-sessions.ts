import "server-only"

import { isDatabaseConfigured, query } from "@/lib/neon/postgres"

/** 某次任务的智能体配置快照（模型 + 约束），随会话落库，续看/预览时用。 */
export interface ChatSessionConfig {
  model?: string
  constraints?: {
    readOnly: boolean
    citeSources: boolean
    unverifiedNotFact: boolean
  }
  [key: string]: unknown
}

export interface ChatSessionSummary {
  id: string
  agentId: string
  title: string
  preview: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface ChatSessionFull extends ChatSessionSummary {
  config: ChatSessionConfig
  /** eve Runtime 的会话游标，原样回喂 useEveAgent.resume */
  eveSession: unknown | null
  /** eve 事件流，原样回喂 useEveAgent.initialEvents */
  eveEvents: unknown[] | null
  /** 我们自己投影的对话记录（role + parts），与 eve 版本无关，永远可回看 */
  transcript: unknown[]
}

export async function createChatSession(input: {
  id: string
  subject: string
  agentId: string
  title: string
  config: ChatSessionConfig
  transcript?: unknown[]
}): Promise<string> {
  if (!isDatabaseConfigured()) throw new Error("DB_NOT_CONFIGURED")
  await query(
    `INSERT INTO chat_sessions (id, subject, agent_id, title, config_json, transcript)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       agent_id = EXCLUDED.agent_id,
       title = EXCLUDED.title,
       config_json = EXCLUDED.config_json,
       updated_at = now()`,
    [
      input.id,
      input.subject,
      input.agentId,
      input.title,
      JSON.stringify(input.config),
      JSON.stringify(input.transcript ?? []),
    ],
  )
  return input.id
}

export async function listChatSessions(
  subject: string,
  limit = 50,
): Promise<ChatSessionSummary[]> {
  if (!isDatabaseConfigured() || !subject) return []
  const { rows } = await query<{
    id: string
    agent_id: string
    title: string
    preview: string
    status: string
    created_at: Date
    updated_at: Date
  }>(
    `SELECT id, agent_id, title, preview, status, created_at, updated_at
       FROM chat_sessions
      WHERE subject = $1
      ORDER BY updated_at DESC
      LIMIT $2`,
    [subject, limit],
  )
  return rows.map((r) => ({
    id: r.id,
    agentId: r.agent_id,
    title: r.title,
    preview: r.preview,
    status: r.status,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }))
}

export async function getChatSession(
  subject: string,
  id: string,
): Promise<ChatSessionFull | null> {
  if (!isDatabaseConfigured() || !subject) return null
  const { rows } = await query<{
    id: string
    agent_id: string
    title: string
    preview: string
    status: string
    created_at: Date
    updated_at: Date
    config_json: ChatSessionConfig
    eve_session: unknown
    eve_events: unknown[]
    transcript: unknown[]
  }>(
    `SELECT id, agent_id, title, preview, status, created_at, updated_at,
            config_json, eve_session, eve_events, transcript
       FROM chat_sessions
      WHERE id = $1 AND subject = $2`,
    [id, subject],
  )
  const r = rows[0]
  if (!r) return null
  return {
    id: r.id,
    agentId: r.agent_id,
    title: r.title,
    preview: r.preview,
    status: r.status,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    config: (r.config_json as ChatSessionConfig) ?? {},
    eveSession: r.eve_session ?? null,
    eveEvents: (r.eve_events as unknown[]) ?? [],
    transcript: (r.transcript as unknown[]) ?? [],
  }
}

export async function updateChatSession(input: {
  subject: string
  id: string
  eveSession?: unknown | null
  eveEvents?: unknown[] | null
  transcript?: unknown[]
  preview?: string
  title?: string
}): Promise<void> {
  if (!isDatabaseConfigured()) throw new Error("DB_NOT_CONFIGURED")
  const sets: string[] = ["updated_at = now()"]
  const params: unknown[] = [input.id, input.subject]
  let i = 3
  if (input.eveSession !== undefined) {
    sets.push(`eve_session = $${i}::jsonb`)
    params.push(JSON.stringify(input.eveSession ?? null))
    i += 1
  }
  if (input.eveEvents !== undefined) {
    sets.push(`eve_events = $${i}::jsonb`)
    params.push(JSON.stringify(input.eveEvents ?? []))
    i += 1
  }
  if (input.transcript !== undefined) {
    sets.push(`transcript = $${i}::jsonb`)
    params.push(JSON.stringify(input.transcript ?? []))
    i += 1
  }
  if (input.preview !== undefined) {
    sets.push(`preview = $${i}`)
    params.push(input.preview)
    i += 1
  }
  if (input.title !== undefined) {
    sets.push(`title = $${i}`)
    params.push(input.title)
    i += 1
  }
  await query(
    `UPDATE chat_sessions SET ${sets.join(", ")} WHERE id = $1 AND subject = $2`,
    params,
  )
}
