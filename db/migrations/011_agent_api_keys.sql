-- 011: 托管服务 API Key
-- 明文只在创建响应里出现一次。库内只存 SHA-256。可重复执行。

CREATE TABLE IF NOT EXISTS agent_api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject      text        NOT NULL,
  key_hash     text        NOT NULL UNIQUE,
  key_prefix   text        NOT NULL,
  label        text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz,
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_agent_api_keys_subject
  ON agent_api_keys (subject, created_at DESC);
