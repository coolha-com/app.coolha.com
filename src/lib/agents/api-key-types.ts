export interface AgentApiKeyRecord {
  id: string
  label: string
  prefix: string
  createdAt: string
  revokedAt: string | null
  lastUsedAt: string | null
}
