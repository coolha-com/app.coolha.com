-- 005: 权益与每日用量（计费 Phase 1）
-- 权益（entitlements）是付费墙的唯一判据；usage_daily 是免费模型额度的计量账本。
-- 计量口径：input_tokens + output_tokens，UTC 自然日窗口（每日 00:00 UTC 重置）。
-- 设计见 docs/PRICING_AND_ENTITLEMENTS.md。
--
-- 注：subject 现阶段为小写钱包地址；Phase 1 引入 users/user_identities 后
--     演进为 user_id::text（见 docs/ACCOUNT_TIER_DESIGN.md 决策二）。

CREATE TABLE IF NOT EXISTS entitlements (
  subject      text PRIMARY KEY,                  -- 小写钱包地址（后续为 user_id::text）
  plan         text        NOT NULL DEFAULT 'free', -- free | plus | pro | ultra
  status       text        NOT NULL DEFAULT 'inactive',
                                                  -- inactive | active | past_due | canceled | expired
  source       text        NOT NULL DEFAULT 'none', -- none | crypto | token_gate | manual
  period_end   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entitlements_status ON entitlements (status)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS usage_daily (
  subject       text   NOT NULL,
  day           date   NOT NULL,                  -- UTC 日期：(now() AT TIME ZONE 'UTC')::date
  requests      integer NOT NULL DEFAULT 0,
  input_tokens  bigint  NOT NULL DEFAULT 0,
  output_tokens bigint  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject, day)
);

CREATE INDEX IF NOT EXISTS idx_usage_daily_day ON usage_daily (day DESC);
