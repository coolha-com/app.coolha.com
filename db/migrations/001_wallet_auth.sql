-- 钱包登录（SIWE）数据表
-- 身份模型：钱包地址即用户身份；会话为不透明令牌（SHA-256 哈希入库，可撤销）。
-- 与 Neon Managed Auth（邮箱体系，neon_auth schema）并存，互不影响。

CREATE TABLE IF NOT EXISTS wallet_users (
  address       TEXT PRIMARY KEY,            -- 小写 0x 地址
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_nonces (
  nonce       TEXT PRIMARY KEY,
  address     TEXT NOT NULL,
  domain      TEXT NOT NULL,
  issued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wallet_nonces_expires ON wallet_nonces (expires_at);

CREATE TABLE IF NOT EXISTS wallet_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,           -- SHA-256(session token)，不明文存令牌
  address    TEXT NOT NULL REFERENCES wallet_users (address) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_address ON wallet_sessions (address);
CREATE INDEX IF NOT EXISTS idx_wallet_sessions_expires ON wallet_sessions (expires_at);
