-- 017：用量明细补上耗时与状态（可空）
--
-- 拿不到耗时或状态时保持 NULL，不写 0、不写假的 success。
-- grant_id 本来就可空：测试开放模式下没有授权也能记账。

ALTER TABLE agent_usage_ledger
  ADD COLUMN IF NOT EXISTS latency_ms integer,
  ADD COLUMN IF NOT EXISTS status text;
