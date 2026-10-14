-- 003: AI Gateway 真实调用用量记录
-- 记录 Playground（后续含 API Key 调用）的每次真实推理：模型、Token、成本、延迟。
-- Phase 2 起步阶段只做审计与展示，不参与计费账本（账本在 Phase 3）。

CREATE TABLE IF NOT EXISTS ai_gateway_usage (
  id                bigserial PRIMARY KEY,
  request_id        text        NOT NULL UNIQUE,
  generation_id     text,
  model_id          text        NOT NULL,
  provider_id       text,
  resolved_provider text,
  source            text        NOT NULL DEFAULT 'playground',
  wallet_address    text,
  client_key        text,
  input_tokens      integer     NOT NULL DEFAULT 0,
  output_tokens     integer     NOT NULL DEFAULT 0,
  total_tokens      integer     NOT NULL DEFAULT 0,
  cost_usd          numeric(18, 10) NOT NULL DEFAULT 0,
  latency_ms        integer     NOT NULL DEFAULT 0,
  status            text        NOT NULL DEFAULT 'success',
  error_code        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_gateway_usage_created_at
  ON ai_gateway_usage (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_gateway_usage_model_id
  ON ai_gateway_usage (model_id);

CREATE INDEX IF NOT EXISTS idx_ai_gateway_usage_wallet
  ON ai_gateway_usage (wallet_address)
  WHERE wallet_address IS NOT NULL;
