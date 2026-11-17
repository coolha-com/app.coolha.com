-- 019：Creem 测试收款订单账本 + Webhook 审计表
--
-- 定位：**仅测试环境**（test-api.creem.io / creem_test_ 前缀）。
-- 这是 Creem 支付通道的技术验证，不改变 AaaS "按执行交付、不按 token 计价" 的模型，
-- 也不恢复任何 Waffo 收款。授权发放复用 agent-billing.ts 的 grantForPaidOrder()。
--
-- 设计要点：
--  1. creem_orders 是我们自己的账本，id 由我们生成，并作为 request_id 传给 Creem。
--     webhook 回传 object.request_id，凭它精确对回用户，不依赖邮箱匹配。
--     同时传 metadata.{subject,orderId} 作双保险。
--  2. 状态机 pending → paid → refunded，单向不回退：
--     paid 只从 pending 迁入、refunded 只从 paid/pending 迁入。
--     重复投递 / 乱序到达都不会重复发授权或复活订单。
--  3. creem_webhook_events 按事件 id 记录，仅用于排查与幂等审计，**不拦截处理**。
--     教训（来自 Waffo）：若先记事件 id 再核销，一旦核销失败，重投会被事件表挡掉，
--     订单永远停在 pending。这里核销幂等由订单状态机保证，事件表只 INSERT 不 gate。
--  4. subject = users.id::text，所有读都按 subject 过滤，物理隔离。
--  5. 幂等：IF NOT EXISTS + 部分唯一索引，重复跑迁移安全。

CREATE TABLE IF NOT EXISTS creem_orders (
  id               text PRIMARY KEY,              -- 我们生成的单号，= 传给 Creem 的 request_id
  subject          text NOT NULL,                 -- users.id::text
  product_id       text NOT NULL,                 -- Creem prod_xxx
  amount_cents     integer,                       -- order.amount_paid（分）；拿不到存 NULL
  currency         text NOT NULL DEFAULT 'USD',
  status           text NOT NULL DEFAULT 'pending',
                                                   -- pending | paid | refunded | failed
  checkout_id      text,                          -- Creem checkout id（ch_xxx）
  creem_order_id   text,                          -- Creem order id（ord_xxx）
  transaction_id   text,                          -- Creem transaction id
  subscription_id  text,                          -- 订阅产品时才有
  customer_id      text,
  customer_email   text,
  checkout_url     text,
  grant_id         text,                          -- 核销后发出的授权 id（agent_service_grants.id）
  raw_event        jsonb,                         -- 最近一次回调原文，便于对账
  paid_at          timestamptz,
  refunded_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Creem checkout id 全局唯一，防止同一笔结账被认领两次
CREATE UNIQUE INDEX IF NOT EXISTS creem_orders_checkout_id_idx
  ON creem_orders (checkout_id)
  WHERE checkout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS creem_orders_subject_idx
  ON creem_orders (subject, created_at DESC);

CREATE INDEX IF NOT EXISTS creem_orders_status_idx
  ON creem_orders (status)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS creem_webhook_events (
  event_id     text PRIMARY KEY,                  -- Creem 事件 id（evt_xxx）
  event_type   text NOT NULL,
  order_id     text,                              -- 我们的单号，便于排查
  raw_payload  jsonb,
  received_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creem_webhook_events_received_idx
  ON creem_webhook_events (received_at DESC);
