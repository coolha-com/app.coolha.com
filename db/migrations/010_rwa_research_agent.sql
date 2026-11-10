-- 010: RWA Research 托管服务的 Profile、订单与执行记录
--
-- 增量且幂等。不改 subscription_orders / compute_ledger：
-- 那套匹配命中后会授予 Plus/Pro/Ultra。研究服务若复用它，会把订阅权益错发给研究订单。
-- 本期不接入链上结算，因此用 CHECK 把付款状态固定为 unpaid，避免写成「已付款」。

CREATE TABLE IF NOT EXISTS rwa_research_profiles (
  subject                         text PRIMARY KEY,
  model_mode                      text        NOT NULL,
  sponsored_model_slug            text,
  byok_connection_id              text,
  byok_model_label                text,
  allowed_tool_ids                text[]      NOT NULL DEFAULT '{}',
  constraint_read_only            boolean     NOT NULL,
  constraint_cite_sources         boolean     NOT NULL,
  constraint_unverified_not_fact  boolean     NOT NULL,
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rwa_research_profiles_mode CHECK (model_mode IN ('sponsored', 'byok')),
  CONSTRAINT rwa_research_profiles_constraints CHECK (
    constraint_read_only
    AND constraint_cite_sources
    AND constraint_unverified_not_fact
  )
);

CREATE TABLE IF NOT EXISTS rwa_research_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject         text        NOT NULL,
  task_text       text        NOT NULL,
  target          text        NOT NULL,
  target_type     text        NOT NULL,
  list_price_usd  numeric(18, 6),
  price_currency  text        NOT NULL DEFAULT 'USD',
  payment_status  text        NOT NULL DEFAULT 'unpaid',
  settlement      text        NOT NULL DEFAULT 'not_wired',
  geo_tier        text,
  channel         text        NOT NULL DEFAULT 'web',
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rwa_research_orders_unpaid CHECK (
    payment_status = 'unpaid'
    AND settlement = 'not_wired'
    AND list_price_usd IS NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_rwa_research_orders_subject
  ON rwa_research_orders (subject, created_at DESC);

CREATE TABLE IF NOT EXISTS rwa_research_executions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject           text        NOT NULL,
  order_id          uuid        NOT NULL REFERENCES rwa_research_orders (id),
  profile_snapshot  jsonb       NOT NULL,
  status            text        NOT NULL,
  report            jsonb,
  narrative         text,
  narrative_source  text,
  narrative_note    text,
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,
  CONSTRAINT rwa_research_executions_status CHECK (status IN ('running', 'succeeded', 'failed')),
  CONSTRAINT rwa_research_executions_narrative_source CHECK (
    narrative_source IS NULL
    OR narrative_source IN ('none', 'sponsored', 'byok_browser')
  )
);

CREATE INDEX IF NOT EXISTS idx_rwa_research_executions_subject
  ON rwa_research_executions (subject, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rwa_research_executions_order
  ON rwa_research_executions (order_id);
