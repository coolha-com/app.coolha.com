-- 会话记录 SIWE 链 ID（修复统一鉴权流程中 getSession 链不匹配问题）
ALTER TABLE wallet_sessions
  ADD COLUMN IF NOT EXISTS chain_id INTEGER;
