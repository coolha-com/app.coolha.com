-- 015：按次付费的 Agent 服务授权与用量账本
--
-- 商业模型（2026-11-12 定稿）：19 U/次，一份服务可用一个月，
-- 期间 token 累计价值到 10 美元后停用（成本护栏，不是对外的计费单位）。
--
-- agent_service_grants = 用户手里的「服务授权」：
--   - 一条 Waffo 已支付订单 → 一份授权（source_order_id 唯一，天然幂等）；
--   - expires_at = granted_at + 1 个月；
--   - token_budget_usd 是这条授权的 token 价值上限，用完即 exhausted。
--
-- agent_usage_ledger = 逐次推理的计量明细（可审计）：
--   - 来自 eve 会话事件流里的 usage.recorded 事实（inputTokens/outputTokens）；
--   - cost_usd 按 OpenRouter 的模型单价换算；拿不到单价时存 NULL，不编造。
--
-- chat_sessions.grant_id = 会话归属哪份授权，计量时据此扣减。
--
-- 幂等：IF NOT EXISTS + ON CONFLICT 兜底。

CREATE TABLE IF NOT EXISTS agent_service_grants (
  id               text PRIMARY KEY,
  subject          text NOT NULL,
  source_order_id  text NOT NULL UNIQUE,            -- Waffo 订单号（我们的单号）
  status           text NOT NULL DEFAULT 'active',   -- active|exhausted|expired|refunded
  granted_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,              -- granted_at + 1 个月
  token_budget_usd numeric NOT NULL DEFAULT 10,      -- token 价值上限
  token_used_usd   numeric NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_service_grants_subject_idx
  ON agent_service_grants (subject, status, expires_at DESC);

CREATE TABLE IF NOT EXISTS agent_usage_ledger (
  id                bigserial PRIMARY KEY,
  subject           text NOT NULL,
  grant_id          text REFERENCES agent_service_grants (id) ON DELETE SET NULL,
  session_id        text,
  model             text,
  input_tokens      integer NOT NULL DEFAULT 0,
  output_tokens     integer NOT NULL DEFAULT 0,
  cache_read_tokens integer NOT NULL DEFAULT 0,
  cost_usd          numeric,                          -- 拿不到单价 → NULL，不编造
  source            text NOT NULL DEFAULT 'chat',
  request_id        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_usage_ledger_subject_idx
  ON agent_usage_ledger (subject, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_usage_ledger_grant_idx
  ON agent_usage_ledger (grant_id);

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS grant_id text;
