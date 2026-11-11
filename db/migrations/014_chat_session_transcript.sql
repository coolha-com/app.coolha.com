-- 014：会话 transcript 独立存档
--
-- eve 的 initialEvents 是 SDK 私有结构，跨 eve 版本可能读不了（旧版事件没有
-- meta.position，resume 会直接抛错，整页崩到 error boundary）。
-- 所以额外存一份「我们自己投影的对话记录」：role + parts，与 eve 版本无关，
-- 历史任务点击后永远能回看；eve 能不能续接只影响「能不能接着聊」。
--
-- 幂等：ALTER TABLE ... ADD COLUMN IF NOT EXISTS。

ALTER TABLE chat_sessions
  ADD COLUMN IF NOT EXISTS transcript jsonb NOT NULL DEFAULT '[]'::jsonb;
