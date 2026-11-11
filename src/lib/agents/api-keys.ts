import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { isDatabaseConfigured, query } from "@/lib/neon/postgres"
import { containsSecretValue } from "@/lib/agents/agent-contracts"
import type { AgentApiKeyRecord } from "@/lib/agents/api-key-types"

const MAX_ACTIVE_KEYS = 5

export type { AgentApiKeyRecord }

interface KeyRow {
  id: string
  label: string
  key_prefix: string
  created_at: Date
  revoked_at: Date | null
  last_used_at: Date | null
}

function toRecord(row: KeyRow): AgentApiKeyRecord {
  return {
    id: row.id,
    label: row.label,
    prefix: row.key_prefix,
    createdAt: row.created_at.toISOString(),
    revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
    lastUsedAt: row.last_used_at ? row.last_used_at.toISOString() : null,
  }
}

export function hashAgentApiKey(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export async function listAgentApiKeys(subject: string): Promise<AgentApiKeyRecord[]> {
  if (!isDatabaseConfigured() || !subject) return []
  const { rows } = await query<KeyRow>(
    `SELECT id, label, key_prefix, created_at, revoked_at, last_used_at
       FROM agent_api_keys
      WHERE subject = $1
      ORDER BY created_at DESC`,
    [subject],
  )
  return rows.map(toRecord)
}

export async function createAgentApiKey(
  subject: string,
  label: string,
): Promise<{ record: AgentApiKeyRecord; secret: string }> {
  const trimmed = label.trim()
  if (trimmed.length < 1 || trimmed.length > 40 || containsSecretValue(trimmed)) {
    throw new Error("INVALID_LABEL")
  }
  const { rows: active } = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM agent_api_keys
      WHERE subject = $1 AND revoked_at IS NULL`,
    [subject],
  )
  if (Number(active[0]?.count ?? 0) >= MAX_ACTIVE_KEYS) {
    throw new Error("KEY_LIMIT")
  }

  const secret = `ck_${randomBytes(32).toString("base64url")}`
  const { rows } = await query<KeyRow>(
    `INSERT INTO agent_api_keys (subject, key_hash, key_prefix, label)
     VALUES ($1,$2,$3,$4)
     RETURNING id, label, key_prefix, created_at, revoked_at, last_used_at`,
    [subject, hashAgentApiKey(secret), secret.slice(0, 11), trimmed],
  )
  return { record: toRecord(rows[0]), secret }
}

export async function revokeAgentApiKey(subject: string, id: string): Promise<boolean> {
  const result = await query(
    `UPDATE agent_api_keys
        SET revoked_at = now()
      WHERE id = $1 AND subject = $2 AND revoked_at IS NULL`,
    [id, subject],
  )
  return (result.rowCount ?? 0) > 0
}

export async function authenticateAgentApiKey(
  token: string,
): Promise<{ subject: string; keyId: string } | null> {
  if (!token.startsWith("ck_") || token.length < 20) return null
  const { rows } = await query<{ id: string; subject: string }>(
    `UPDATE agent_api_keys
        SET last_used_at = now()
      WHERE key_hash = $1 AND revoked_at IS NULL
      RETURNING id, subject`,
    [hashAgentApiKey(token)],
  )
  const row = rows[0]
  return row ? { subject: row.subject, keyId: row.id } : null
}
