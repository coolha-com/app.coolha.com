-- 014：Waffo Pancake 法币订单账本 + Webhook 幂等表
--
-- 商业模型（2026-11-11 定稿）：一次性购买 Agent 服务 $19/次，法币收款由
-- Waffo Pancake 作 Merchant of Record 承载。三条资金流永不交叉：
--   法币（Waffo）≠ 链上稳定币 ≠ x402（留给后续阶段）。
-- 详见 docs/PROJECT_OVERVIEW.md §5 与 .workbuddy/memory/MEMORY.md。
--
-- 设计要点：
--  1. waffo_orders 是**我们自己**的订单账本，不是 Waffo 的镜像。
--     id 由我们生成，同时以 orderMerchantExternalId 传给 Waffo，
--     这样 webhook 回来时能凭它精确对回用户，不依赖邮箱匹配。
--  2. 状态机 pending → paid → refunded，单向且不回退：
--     paid 只从 pending 迁入、refunded 只从 pending/paid 迁入，
--     因此「同一个事件被重投」与「事件乱序到达」都不会重复核销或复活订单。
--  3. waffo_webhook_events 按投递 id（WebhookEvent.id）去重：
--     Waffo 的重试策略是「非 2xx 就重投，最多 4 次」，
--     这里用主键冲突拦截重复投递。
--  4. subject 统一用 users.id::text（与 chat_threads / subscription_orders 一致），
--     所有读都按 subject 过滤，物理隔离。
--  5. 幂等：IF NOT EXISTS + ON CONFLICT 兜底，重复跑迁移安全。

CREATE TABLE IF NOT EXISTS waffo_orders (
  id                text PRIMARY KEY,           -- 我们生成的单号，同时是 orderMerchantExternalId
  subject           text NOT NULL,              -- users.id::text
  product_id        text NOT NULL,
  currency          text NOT NULL DEFAULT 'USD',
  amount            text NOT NULL DEFAULT '',   -- 显示字符串，如 "19.00"
  status            text NOT NULL DEFAULT 'pending',
                                                  -- pending | paid | refunded | failed
  buyer_email       text,
  buyer_identity    text,                       -- 传给 Waffo 的 buyerIdentity（= subject）
  checkout_url      text,
  waffo_order_id    text,                       -- Waffo 侧订单号 ORD_xxx
  waffo_payment_id  text,
  paid_at           timestamptz,
  refunded_at       timestamptz,
  raw_event         jsonb,                      -- 最近一次回调原文，便于对账
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Waffo 侧订单号全局唯一，防止同一笔订单被认领两次
CREATE UNIQUE INDEX IF NOT EXISTS waffo_orders_waffo_order_id_idx
  ON waffo_orders (waffo_order_id)
  WHERE waffo_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS waffo_orders_subject_idx
  ON waffo_orders (subject, created_at DESC);

CREATE INDEX IF NOT EXISTS waffo_orders_status_idx
  ON waffo_orders (status)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS waffo_webhook_events (
  event_id     text PRIMARY KEY,               -- WebhookEvent.id（投递记录唯一 ID）
  event_type   text NOT NULL,
  order_id     text,                           -- Waffo 侧订单号，便于排查
  received_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waffo_webhook_events_received_idx
  ON waffo_webhook_events (received_at DESC);
