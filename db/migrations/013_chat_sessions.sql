-- 013：智能对话任务留档（Agent 会话持久化）
--
-- 把「在智能对话里选中智能体 → 配置 → 对话执行任务 → 存入历史 → 点击续看」这条链路
-- 落库，做到跨设备、与 /tasks 一致。
--
-- 设计要点：
--  1. subject 用 users.id::text（与 chat_threads / 订单一致），所有读都按 subject 过滤，物理隔离。
--  2. 对话引擎是 eve Runtime，它的会话游标（eve_session）与事件流（eve_events）是 SDK 私有结构，
--     不拆字段，整体以 jsonb 存两份 blob，挂载时原样喂回 useEveAgent 的 resume + initialSession/initialEvents。
--  3. config_json 存该次任务的智能体配置快照（模型 + 约束），预览/续看时用得到。
--  4. preview / updated_at 仅用于历史列表展示与排序，正文以 eve_events 为准。
--  5. 幂等：IF NOT EXISTS + ON CONFLICT 兜底，重复跑迁移安全。

CREATE TABLE IF NOT EXISTS chat_sessions (
  id           text PRIMARY KEY,
  subject      text NOT NULL,
  agent_id     text NOT NULL,
  title        text NOT NULL DEFAULT '',
  config_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  eve_session  jsonb,
  eve_events   jsonb,
  preview      text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'active',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_sessions_subject_idx
  ON chat_sessions (subject, updated_at DESC);
