-- 018：Coolha RWA Agent P0
--
-- 只描述链上读到的资产、合约映射、来源、快照和研究章节。
-- 付款状态锁在 unpaid，避免把未收款写成已收款。
-- agent_service_grants.usage_budget 只预留列，P0 不读取、不执行。
-- 幂等：IF NOT EXISTS / ADD COLUMN IF NOT EXISTS。

CREATE TABLE IF NOT EXISTS rwa_assets (
  id          text PRIMARY KEY,
  name        text,
  symbol      text,
  issuer_name text,
  asset_class text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rwa_asset_contracts (
  id          text PRIMARY KEY,
  asset_id    text NOT NULL REFERENCES rwa_assets (id) ON DELETE CASCADE,
  chain_key   text NOT NULL,
  chain_id    integer NOT NULL,
  address     text NOT NULL,
  read_status text NOT NULL DEFAULT 'rpc_read',
  UNIQUE (chain_key, address)
);

CREATE INDEX IF NOT EXISTS rwa_asset_contracts_asset_idx
  ON rwa_asset_contracts (asset_id);

CREATE TABLE IF NOT EXISTS rwa_asset_sources (
  id          text PRIMARY KEY,
  asset_id    text NOT NULL REFERENCES rwa_assets (id) ON DELETE CASCADE,
  source_kind text NOT NULL,
  label       text NOT NULL,
  note        text,
  fetched_at  timestamptz
);

CREATE TABLE IF NOT EXISTS rwa_research_reports (
  id             text PRIMARY KEY,
  subject        text,
  asset_id       text REFERENCES rwa_assets (id) ON DELETE SET NULL,
  chain_key      text,
  address        text,
  sections       jsonb NOT NULL,
  payment_status text NOT NULL DEFAULT 'unpaid',
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rwa_research_reports_unpaid CHECK (payment_status = 'unpaid')
);

CREATE INDEX IF NOT EXISTS rwa_research_reports_asset_idx
  ON rwa_research_reports (asset_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rwa_asset_snapshots (
  id           bigserial PRIMARY KEY,
  asset_id     text REFERENCES rwa_assets (id) ON DELETE SET NULL,
  chain_key    text NOT NULL,
  address      text NOT NULL,
  block_number bigint,
  payload      jsonb NOT NULL,
  gaps         jsonb NOT NULL,
  fetched_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rwa_asset_snapshots_asset_idx
  ON rwa_asset_snapshots (asset_id, fetched_at DESC);

ALTER TABLE agent_service_grants
  ADD COLUMN IF NOT EXISTS usage_budget jsonb;

COMMENT ON COLUMN agent_service_grants.usage_budget IS
  '预留的双重用量限制。P0 不读取、不执行，也不是按 token 售卖的价目。';
