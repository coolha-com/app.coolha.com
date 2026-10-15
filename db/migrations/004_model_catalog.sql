-- 004: 模型目录落库（上游目录 → Neon → 客户端读库）
--
-- 目的：目录数据持久化到自有数据库。读请求不再回源上游 Vercel AI Gateway，
--      上游调用频率从「按流量」降为「按 TTL（默认 1 小时）」，显著降低限额消耗。
--
-- 同步策略：读时惰性同步 + 数据库级认领锁（同一时刻只有一个实例回源）；
--      上游失败时保留并使用陈旧快照兜底（优于演示数据，且绝不伪造实时数据）。

CREATE TABLE IF NOT EXISTS model_catalog (
  id               text PRIMARY KEY,             -- 站内 slug（ComputeModel.id）
  model_id         text        NOT NULL,         -- 上游模型 ID
  gateway_model_id text,
  provider_id      text,
  provider_name    text,
  type             text        NOT NULL,
  name             text        NOT NULL,
  input_price      numeric(18, 10),
  output_price     numeric(18, 10),
  context_length   integer,
  status           text,
  data_source      text        NOT NULL DEFAULT 'ai-gateway',
  payload          jsonb       NOT NULL,         -- 归一化后的完整 ComputeModel（结构演进无需改表）
  synced_at        timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_catalog_provider ON model_catalog (provider_id);
CREATE INDEX IF NOT EXISTS idx_model_catalog_type     ON model_catalog (type);
CREATE INDEX IF NOT EXISTS idx_model_catalog_price    ON model_catalog (input_price);

-- 同步元数据：单行（id = 1），syncing_at 为认领锁，防止多实例并发回源
CREATE TABLE IF NOT EXISTS model_catalog_sync (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  source      text        NOT NULL DEFAULT 'ai-gateway',
  model_count integer     NOT NULL DEFAULT 0,
  synced_at   timestamptz NOT NULL DEFAULT now(),
  syncing_at  timestamptz,
  last_error  text
);

INSERT INTO model_catalog_sync (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
