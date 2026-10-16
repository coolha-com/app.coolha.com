import "server-only"

import { query, transaction } from "./postgres"
import { readPlan } from "./quota"
import { resolveSubject } from "./identity"
import { getWalletSessionFromCookies } from "./wallet-auth"
import type { PlanDefinition } from "@/lib/compute/plans"

/**
 * 会话历史（服务端）。付费权益的物理载体：
 * - historyDays = 0（Free）→ 完全没有云历史，只能存浏览器；
 * - historyDays / historyThreads 决定保留期与条数上限；
 * - 删除为软删除（deleted_at），一键清空才是硬删除。
 *
 * 隐私边界：只存对话正文与模型标识，**任何 API Key 都不落库**。
 * 文件 / 图片的 dataUrl 由客户端在上传前剥离，避免把 4MB base64 灌进数据库。
 */

export class ChatHistoryError extends Error {
  constructor(
    readonly code:
      | "HISTORY_DISABLED"
      | "THREAD_LIMIT"
      | "THREAD_NOT_FOUND"
      | "TOO_MANY_MESSAGES"
      | "INVALID_PAYLOAD",
    message: string,
  ) {
    super(message)
    this.name = "ChatHistoryError"
  }
}

export interface CloudThread {
  id: string
  title: string
  modelKey: string | null
  pinned: boolean
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface CloudMessage {
  id: string
  role: "user" | "assistant" | "system"
  parts: unknown[]
  text: string
  modelKey: string | null
  source: "gateway" | "byok"
  inputTokens: number
  outputTokens: number
  createdAt: string
}

export interface IncomingMessage {
  role: "user" | "assistant" | "system"
  parts?: unknown
  text?: string
  modelKey?: string | null
  source?: "gateway" | "byok"
  inputTokens?: number
  outputTokens?: number
}

const MAX_MESSAGES_PER_THREAD = 500
const MAX_TEXT_CHARS = 100_000
const DEFAULT_LIST_LIMIT = 200

/** 读取档位并判定当前 subject 是否享有云历史；不享有返回 null */
export async function readHistoryPlan(subject: string): Promise<PlanDefinition | null> {
  if (!subject) return null
  const plan = await readPlan(subject)
  return plan.limits.historyDays === 0 ? null : plan
}

export type HistoryAuth =
  | { ok: true; subject: string; plan: PlanDefinition }
  | { ok: false; status: number; code: string; message: string }

/**
 * 路由层统一鉴权：未登录 401；档位不含云历史 403（Free 档）。
 * 注意「未登录」与「档位不足」必须分开报——前者引导签名，后者引导升级。
 */
export async function authorizeHistory(): Promise<HistoryAuth> {
  const session = await getWalletSessionFromCookies()
  if (!session) {
    return { ok: false, status: 401, code: "AUTH_REQUIRED", message: "请先连接钱包并签名登录" }
  }
  const subject = await resolveSubject(session.address)
  const plan = await readHistoryPlan(subject)
  if (!plan) {
    return {
      ok: false,
      status: 403,
      code: "HISTORY_DISABLED",
      message: "当前档位不含云端历史，会话仅保存在本机浏览器；升级后可跨设备同步",
    }
  }
  return { ok: true, subject, plan }
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value)
}

function mapThread(row: {
  id: string
  title: string
  model_key: string | null
  pinned: boolean
  message_count: number
  created_at: Date
  updated_at: Date
}): CloudThread {
  return {
    id: row.id,
    title: row.title,
    modelKey: row.model_key,
    pinned: Boolean(row.pinned),
    messageCount: Number(row.message_count ?? 0),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value)
}

function sanitizeMessages(input: unknown): IncomingMessage[] {
  if (!Array.isArray(input)) throw new ChatHistoryError("INVALID_PAYLOAD", "messages 必须为数组")
  if (input.length > MAX_MESSAGES_PER_THREAD) {
    throw new ChatHistoryError("TOO_MANY_MESSAGES", `单会话最多 ${MAX_MESSAGES_PER_THREAD} 条消息`)
  }
  return input.map((raw) => {
    const item = (raw ?? {}) as IncomingMessage
    const role =
      item.role === "assistant" || item.role === "system" ? item.role : "user"
    const parts = Array.isArray(item.parts) ? item.parts : []
    const text = typeof item.text === "string" ? item.text.slice(0, MAX_TEXT_CHARS) : ""
    return {
      role,
      parts,
      text,
      modelKey: typeof item.modelKey === "string" ? item.modelKey : null,
      source: item.source === "byok" ? "byok" : "gateway",
      inputTokens: Number.isFinite(item.inputTokens) ? Math.max(0, Number(item.inputTokens)) : 0,
      outputTokens: Number.isFinite(item.outputTokens) ? Math.max(0, Number(item.outputTokens)) : 0,
    }
  })
}

/** 会话列表：按档位应用保留期与条数上限 */
export async function listThreads(subject: string, plan: PlanDefinition): Promise<CloudThread[]> {
  const days = plan.limits.historyDays
  const limit = plan.limits.historyThreads ?? DEFAULT_LIST_LIMIT
  const { rows } = await query<Parameters<typeof mapThread>[0]>(
    `SELECT id, title, model_key, pinned, message_count, created_at, updated_at
       FROM chat_threads
      WHERE subject = $1
        AND deleted_at IS NULL
        AND ($2::int IS NULL OR updated_at >= now() - make_interval(days => $2))
      ORDER BY pinned DESC, updated_at DESC
      LIMIT $3`,
    [subject, days, limit],
  )
  return rows.map(mapThread)
}

/** 新建会话；条数已达档位上限时抛 THREAD_LIMIT。允许客户端自带 uuid，避免创建后再改本地 id */
export async function createThread(
  subject: string,
  plan: PlanDefinition,
  input: { id?: string; title?: string; modelKey?: string },
): Promise<CloudThread> {
  const limit = plan.limits.historyThreads
  if (limit !== null) {
    const { rows } = await query<{ count: string }>(
      `SELECT count(*)::text AS count FROM chat_threads WHERE subject = $1 AND deleted_at IS NULL`,
      [subject],
    )
    if (Number(rows[0]?.count ?? 0) >= limit) {
      throw new ChatHistoryError(
        "THREAD_LIMIT",
        `当前档位最多保留 ${limit} 条会话，请删除旧会话或升级档位`,
      )
    }
  }
  const clientId = isUuid(input.id) ? input.id : null
  const { rows } = await query<Parameters<typeof mapThread>[0]>(
    `INSERT INTO chat_threads (id, subject, title, model_key)
     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4)
     RETURNING id, title, model_key, pinned, message_count, created_at, updated_at`,
    [clientId, subject, (input.title ?? "新对话").slice(0, 120), input.modelKey ?? null],
  )
  return mapThread(rows[0])
}

/** 读取单个会话（含消息）；越权返回 null */
export async function getThread(
  subject: string,
  threadId: string,
): Promise<{ thread: CloudThread; messages: CloudMessage[] } | null> {
  const { rows } = await query<Parameters<typeof mapThread>[0]>(
    `SELECT id, title, model_key, pinned, message_count, created_at, updated_at
       FROM chat_threads
      WHERE id = $1 AND subject = $2 AND deleted_at IS NULL`,
    [threadId, subject],
  )
  const row = rows[0]
  if (!row) return null

  const { rows: messageRows } = await query<{
    id: string
    role: string
    parts: unknown
    text_content: string
    model_key: string | null
    source: string
    input_tokens: string | number
    output_tokens: string | number
    created_at: Date
  }>(
    `SELECT id, role, parts, text_content, model_key, source, input_tokens, output_tokens, created_at
       FROM chat_messages
      WHERE thread_id = $1
      ORDER BY seq ASC`,
    [threadId],
  )

  return {
    thread: mapThread(row),
    messages: messageRows.map((item) => ({
      id: item.id,
      role: (item.role === "assistant" || item.role === "system" ? item.role : "user") as
        | "user"
        | "assistant"
        | "system",
      parts: Array.isArray(item.parts) ? item.parts : [],
      text: item.text_content ?? "",
      modelKey: item.model_key,
      source: item.source === "byok" ? "byok" : "gateway",
      inputTokens: Number(item.input_tokens ?? 0),
      outputTokens: Number(item.output_tokens ?? 0),
      createdAt: iso(item.created_at),
    })),
  }
}

/** 全量替换会话消息并更新元信息（客户端每次交互后整体上报，实现简单且幂等） */
export async function replaceMessages(
  subject: string,
  threadId: string,
  messages: unknown,
  meta: { title?: string; modelKey?: string },
): Promise<void> {
  const clean = sanitizeMessages(messages)
  const payload = JSON.stringify(
    clean.map((item, index) => ({
      seq: index,
      role: item.role,
      parts: item.parts,
      text: item.text,
      modelKey: item.modelKey,
      source: item.source,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens,
    })),
  )

  await transaction(async (client) => {
    const owned = await client.query(
      `SELECT id FROM chat_threads WHERE id = $1 AND subject = $2 AND deleted_at IS NULL`,
      [threadId, subject],
    )
    if (!owned.rowCount) throw new ChatHistoryError("THREAD_NOT_FOUND", "会话不存在或无权访问")

    await client.query(`DELETE FROM chat_messages WHERE thread_id = $1`, [threadId])

    if (clean.length > 0) {
      await client.query(
        `INSERT INTO chat_messages
           (thread_id, seq, role, parts, text_content, model_key, source, input_tokens, output_tokens)
         SELECT $1::uuid,
                (item->>'seq')::int,
                item->>'role',
                COALESCE(item->'parts', '[]'::jsonb),
                COALESCE(item->>'text', ''),
                NULLIF(item->>'modelKey', ''),
                COALESCE(item->>'source', 'gateway'),
                COALESCE((item->>'inputTokens')::bigint, 0),
                COALESCE((item->>'outputTokens')::bigint, 0)
           FROM jsonb_array_elements($2::jsonb) AS item`,
        [threadId, payload],
      )
    }

    await client.query(
      `UPDATE chat_threads
          SET message_count = $2,
              model_key     = COALESCE($3, model_key),
              title         = CASE WHEN title = '新对话' AND $4::text IS NOT NULL
                                   THEN $4 ELSE title END,
              updated_at    = now(),
              last_message_at = now()
        WHERE id = $1`,
      [threadId, clean.length, meta.modelKey ?? null, meta.title ?? null],
    )
  })
}

/** 重命名 / 置顶 */
export async function updateThread(
  subject: string,
  threadId: string,
  patch: { title?: string; pinned?: boolean; modelKey?: string },
): Promise<void> {
  const { rowCount } = await query(
    `UPDATE chat_threads
        SET title      = COALESCE($3, title),
            pinned     = COALESCE($4, pinned),
            model_key  = COALESCE($5, model_key),
            updated_at = now()
      WHERE id = $1 AND subject = $2 AND deleted_at IS NULL`,
    [
      threadId,
      subject,
      typeof patch.title === "string" ? patch.title.slice(0, 120) : null,
      typeof patch.pinned === "boolean" ? patch.pinned : null,
      typeof patch.modelKey === "string" ? patch.modelKey : null,
    ],
  )
  if (!rowCount) throw new ChatHistoryError("THREAD_NOT_FOUND", "会话不存在或无权访问")
}

/** 软删除：进回收站，数据仍在，可在保留期内恢复 */
export async function softDeleteThread(subject: string, threadId: string): Promise<void> {
  const { rowCount } = await query(
    `UPDATE chat_threads SET deleted_at = now() WHERE id = $1 AND subject = $2 AND deleted_at IS NULL`,
    [threadId, subject],
  )
  if (!rowCount) throw new ChatHistoryError("THREAD_NOT_FOUND", "会话不存在或无权访问")
}

/** 一键清空：硬删除该 subject 名下全部会话与消息（CASCADE） */
export async function purgeHistory(subject: string): Promise<number> {
  const { rowCount } = await query(`DELETE FROM chat_threads WHERE subject = $1`, [subject])
  return rowCount
}
