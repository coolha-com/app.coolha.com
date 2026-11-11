-- 012: Web2 登入（Neon Auth）接线与用量主体
--
-- 身份模型不变：users.id 是「人」，user_identities 是「凭证」。
-- 本次扩展三件事：
--   ① user_identities.kind 增加 email / neon_auth 两种（原先只有 evm_signing）；
--   ② users 增加展示字段快照（邮箱/昵称/头像），避免每次读库都要跨 neon_auth schema；
--   ③ ai_gateway_usage 增加 subject 列——原先把 users.id::text 塞进 wallet_address 是错的，
--      Web2 用户没有钱包地址，再复用该列会让「钱包地址」一栏显示一串 uuid。

-- ① 身份种类：evm_signing（钱包）| email（邮箱，按小写归一）| neon_auth（Neon Auth 用户 id）
COMMENT ON COLUMN user_identities.kind IS 'evm_signing | email | neon_auth';
CREATE INDEX IF NOT EXISTS idx_user_identities_kind ON user_identities (kind);

-- ② 用户展示信息快照
ALTER TABLE users ADD COLUMN IF NOT EXISTS primary_email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_users_primary_email
  ON users (lower(primary_email))
  WHERE primary_email IS NOT NULL;

-- ③ 用量主体：新增 subject，回填历史（旧数据把 subject 存在 wallet_address 里）
ALTER TABLE ai_gateway_usage ADD COLUMN IF NOT EXISTS subject text;

UPDATE ai_gateway_usage
   SET subject = wallet_address
 WHERE subject IS NULL
   AND wallet_address IS NOT NULL;

-- wallet_address 从此只存真正的 0x 地址；历史 uuid 值不再冒充地址
UPDATE ai_gateway_usage
   SET wallet_address = NULL
 WHERE wallet_address IS NOT NULL
   AND wallet_address NOT LIKE '0x%';

CREATE INDEX IF NOT EXISTS idx_ai_gateway_usage_subject
  ON ai_gateway_usage (subject, created_at DESC)
  WHERE subject IS NOT NULL;
