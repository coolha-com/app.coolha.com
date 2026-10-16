-- 008：会话历史上云
--
-- 付费权益的物理载体：保留期 / 条数 / 全文检索 / 导出 全部由这两张表支撑。
-- 设计要点：
--  1. subject 用 users.id::text（身份层不可用时降级 wallet:0x...），与 entitlements / usage_daily 一致。
--  2. 软删除 deleted_at：用户删除先进回收站，期满才真删，避免误删不可恢复。
--  3. messages 存 AI SDK UIMessage.parts，但**文件/图片的 dataUrl 不落库**（客户端上传前剥离，只留占位符）——
--     否则一张 4MB 图片会把整条会话撑爆。
--  4. text_content 为纯文本投影，search_tsv 由它生成，供 Pro 档全文检索（P3）使用。
--  5. 不存任何 API Key：BYOK 只存对话正文与模型标识，密钥永远留在浏览器。

CREATE TABLE IF NOT EXISTS chat_threads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject         text NOT NULL,
  title           text NOT NULL DEFAULT '新对话',
  model_key       text,
  pinned          boolean NOT NULL DEFAULT false,
  message_count   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS chat_threads_subject_idx
  ON chat_threads (subject, deleted_at, last_message_at DESC);

CREATE INDEX IF NOT EXISTS chat_threads_subject_updated_idx
  ON chat_threads (subject, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     uuid NOT NULL REFERENCES chat_threads (id) ON DELETE CASCADE,
  seq           integer NOT NULL,
  role          text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  parts         jsonb NOT NULL DEFAULT '[]'::jsonb,
  text_content  text NOT NULL DEFAULT '',
  model_key     text,
  source        text NOT NULL DEFAULT 'gateway' CHECK (source IN ('gateway', 'byok')),
  input_tokens  bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  search_tsv    tsvector GENERATED ALWAYS AS (
                  to_tsvector('simple', coalesce(text_content, ''))
                ) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_thread_seq_idx
  ON chat_messages (thread_id, seq);

CREATE INDEX IF NOT EXISTS chat_messages_tsv_idx
  ON chat_messages USING gin (search_tsv);
