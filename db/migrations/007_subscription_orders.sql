-- 007: 链上订阅订单与账本
--
-- 收款方式：订单匹配法（docs/PRICING_AND_ENTITLEMENTS.md 5.2）
--   下单 → 用户从计费地址转**精确金额**（含 0~9 分指纹尾数）→ 按
--   (chain, token, amount_raw, 状态未过期) 匹配；优先匹配 from == 用户地址。
-- 幂等：同一笔转账（tx_hash + log_index）只能入账一次。
-- 合规：geo_tier 在下单时记录，hard-block 地区不允许创建订单（防止链上支付绕过地理屏蔽）。

CREATE TABLE IF NOT EXISTS subscription_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject        text        NOT NULL,          -- users.id::text
  wallet_address text        NOT NULL,          -- 下单时的登录地址（审计/展示）
  plan           text        NOT NULL,          -- plus | pro | ultra
  chain          text        NOT NULL,          -- base | ethereum
  token          text        NOT NULL,          -- USDC | USDT
  token_address  text        NOT NULL,
  pay_to         text        NOT NULL,
  amount_cents   integer     NOT NULL,          -- USD 分（含指纹尾数）
  amount_token   numeric(30, 8) NOT NULL,       -- 人类单位，如 10.07
  amount_raw     numeric(40, 0) NOT NULL,       -- 最小单位整数
  status         text        NOT NULL DEFAULT 'pending',
                                                -- pending | paid | expired | canceled | refunded
  tx_hash        text,
  log_index      integer,
  from_address   text,                          -- 实际付款地址（=计费地址）
  geo_tier       text,
  period_days    integer     NOT NULL DEFAULT 30,
  expires_at     timestamptz NOT NULL,
  paid_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 一笔链上转账只能入账一次
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscription_orders_tx
  ON subscription_orders (tx_hash, log_index)
  WHERE tx_hash IS NOT NULL;

-- 匹配候选：未过期 pending 订单按 (chain, token, amount_raw) 命中
CREATE INDEX IF NOT EXISTS idx_subscription_orders_match
  ON subscription_orders (status, chain, token, amount_raw)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_subscription_orders_subject
  ON subscription_orders (subject, created_at DESC);

CREATE TABLE IF NOT EXISTS compute_ledger (
  id           bigserial PRIMARY KEY,
  subject      text NOT NULL,                   -- users.id::text
  kind         text NOT NULL,                   -- subscription | refund | adjustment
  amount_usd   numeric(18, 6) NOT NULL,
  plan         text,
  memo         text,
  ref_order_id uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compute_ledger_subject
  ON compute_ledger (subject, created_at DESC);
