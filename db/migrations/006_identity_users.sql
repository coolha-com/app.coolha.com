-- 006: 内部身份 users / user_identities / billing_addresses
--
-- 依据 docs/ARCHITECTURE_IDENTITY_BILLING.md 决策二与三：
--   ① 不要把「人」等同于「地址」——地址是凭证，user_id 才是人；
--   ② 计费地址与身份地址分离（身份地址只签名，计费地址只证明钱从哪来，无鉴权权）。
--
-- 迁移后，entitlements / usage_daily / billing_addresses 的 subject 一律为 users.id::text；
-- wallet_users（小写地址）回填为 user_identities(kind='evm_signing')，保留原表不动。

CREATE TABLE IF NOT EXISTS users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status     text NOT NULL DEFAULT 'active',   -- active | suspended
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_identities (
  kind       text NOT NULL,                    -- evm_signing | email
  address    text NOT NULL,                    -- 小写 EVM 地址 / 邮箱
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, address)
);
CREATE INDEX IF NOT EXISTS idx_user_identities_user ON user_identities (user_id);

CREATE TABLE IF NOT EXISTS billing_addresses (
  subject    text NOT NULL,                    -- users.id::text
  address    text NOT NULL,                    -- 小写 EVM 地址
  label      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject, address)
);

-- 回填：wallet_users → users + user_identities（幂等，已存在的地址跳过）
WITH pending AS (
  SELECT w.address
    FROM wallet_users w
   WHERE NOT EXISTS (
     SELECT 1 FROM user_identities i
      WHERE i.kind = 'evm_signing' AND i.address = w.address
   )
),
created AS (
  INSERT INTO users (id)
  SELECT gen_random_uuid() FROM pending
  RETURNING id
),
ranked AS (
  SELECT address, row_number() OVER (ORDER BY address) AS rn FROM pending
),
numbered AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn FROM created
)
INSERT INTO user_identities (kind, address, user_id)
SELECT 'evm_signing', r.address, n.id
  FROM ranked r JOIN numbered n USING (rn);

-- subject 演进：地址 → user_id::text（已存在目标行则跳过，避免主键冲突）
UPDATE entitlements e
   SET subject = i.user_id::text
  FROM user_identities i
 WHERE i.kind = 'evm_signing'
   AND i.address = e.subject
   AND e.subject LIKE '0x%'
   AND NOT EXISTS (SELECT 1 FROM entitlements x WHERE x.subject = i.user_id::text);

UPDATE usage_daily u
   SET subject = i.user_id::text
  FROM user_identities i
 WHERE i.kind = 'evm_signing'
   AND i.address = u.subject
   AND u.subject LIKE '0x%'
   AND NOT EXISTS (
     SELECT 1 FROM usage_daily x WHERE x.subject = i.user_id::text AND x.day = u.day
   );
