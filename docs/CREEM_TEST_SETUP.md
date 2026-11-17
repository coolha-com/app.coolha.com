# Creem 测试收款通道接入（联调说明）

> 状态：**仅测试环境**（`test-api.creem.io` + `creem_test_` key）。不改变 AaaS「按执行交付、不按 token 计价」的商业模型，不恢复 Waffo。支付成功只发放一份 Agent 服务授权。

## 已落地的代码

| 文件 | 作用 |
|---|---|
| `db/migrations/019_creem_orders.sql` | `creem_orders`（自建订单，request_id 唯一，状态机 pending→paid→refunded）+ `creem_webhook_events`（事件审计，不 gate 核销） |
| `src/lib/neon/creem.ts` | 创建 checkout、核销发授权、退款作废、订单查询；强制 test key；串单防护 |
| `src/app/api/creem/checkout/route.ts` | `POST` 建结账会话（需登录），`GET` 我的测试订单 |
| `src/app/api/creem/webhook/route.ts` | `POST` raw-body HMAC-SHA256 验签，事件路由与幂等核销 |
| `src/components/billing/CreemTestCheckoutButton.tsx` | 测试购买按钮 |
| `src/app/(APP)/billing/subscription/page.tsx` | 配置后显示「Creem 支付通道联调（测试）」入口 |
| `.env.local.example` / `scripts/sync-vercel-env.mjs` | 新增 CREEM_* 变量模板；这些变量设为纯本地，不上云 |

设计要点：
- 订单号由我们生成，作为 `request_id` 传给 Creem；webhook 回来用 `object.request_id` 精确对回用户，**不靠邮箱匹配**。
- 付款成功 → 复用 `grantForPaidOrder()` 发授权（30 天有效、$10 token 成本护栏）；退款 → `revokeGrantForOrder()` 作废。授权层一行没改。
- 幂等三重保险：订单状态机 + `source_order_id` UNIQUE + 事件表只审计不拦截。Creem 重投不会重复发授权。

## 你需要做的（按顺序）

### 1. 配置本地凭证
编辑项目根目录 `.env.local`（或 `.env.development.local`），填入：

```
CREEM_API_KEY=creem_test_你的测试key
CREEM_PRODUCT_ID=prod_你创建的产品ID
CREEM_WEBHOOK_SECRET=你的webhook签名密钥
CREEM_SUCCESS_URL=http://localhost:3000/billing/subscription
```

- key 在 <https://creem.io/dashboard/api-keys>，必须是 `creem_test_` 前缀；live key 会被服务端拒绝。
- product ID 就是你已经建好的测试产品（`prod_` 开头）。
- webhook secret 下一步创建端点后会显示。
- 这四个变量已在同步脚本里设为纯本地，**不会被推到 Vercel**（测试 key 不该上云）。

### 2. 应用数据库迁移（打 dev 库）
```bash
node scripts/apply-migration.mjs db/migrations/019_creem_orders.sql
```
默认打 Neon dev 分支。不要加 `--prod`。

### 3. 注册 webhook 端点（本地联调）
用 Creem CLI 开隧道转发，无需公网地址、自动带真实签名头：
```bash
brew tap armitage-labs/creem && brew install creem   # Windows 可用 WSL / 或直接在 dashboard 配公网地址
creem login --api-key creem_test_你的测试key
creem listen --forward-to http://localhost:3000/api/creem/webhook
```
把输出的 webhook secret 填进 `CREEM_WEBHOOK_SECRET`。
订阅的事件至少勾：`checkout.completed`、`refund.created`（代码也支持 `subscription.active/paid`、`dispute.created`）。

也可用 ngrok 把 `http://localhost:3000/api/creem/webhook` 暴露成 HTTPS，在 dashboard → Developers 里注册。

### 4. 起本地服务并联调
按项目惯例起 Next（需要 Node 24：`export PATH=/c/Program\ Files/nodejs:$PATH && unset NODE_OPTIONS`，`next dev --webpack`）。
浏览器登录账号 → 打开 `/billing/subscription` → 看到「Creem 支付通道联调（测试）」→ 点「打开 Creem 测试结账」→ 用 Creem 测试卡完成付款 → webhook 触发 → 账号获得一份服务授权（`readGrantState` 可见）。

### 5. 验证
- 订单：`GET /api/creem/checkout`（需登录）应返回刚建的订单，`status=paid`。
- 授权：`/billing` 页面「已有授权」区块出现新记录；或查 `agent_service_grants` 里 `source_order_id = 订单号`。
- 幂等：在 dashboard 手动重发 `checkout.completed`，授权不会重复发放。
- 退款：在 dashboard 触发 `refund.created`，授权状态变 `refunded`。

## 本地冒烟脚本（无需公网域名 / 无需真实回调）

如果只想验证代码逻辑，不必在系统里建 webhook 端点、也不用内网穿透。两个脚本自己登录、自己构造带正确签名的事件、跑完全自动清理测试数据：

```bash
# 起 dev（Node 24）
export PATH="/c/Program Files/nodejs:$PATH" && unset NODE_OPTIONS && npm run dev

# ① 建单链路：登录 → checkout → 落库 → 查单 → 清理
node scripts/creem-smoke.mjs

# ② webhook 链路：签名校验 → 发授权 → 重投幂等 → 退款作废 → 清理
#    需要一个临时 secret，仅通过进程环境注入，不写进任何文件：
CREEM_WEBHOOK_SECRET=smoke_secret_dev node scripts/creem-webhook-smoke.mjs
```

`creem-smoke.mjs` 会真实打 Creem 沙箱的 `POST /v1/checkouts`（只建会话不付款）；`creem-webhook-smoke.mjs` 用同一个临时 secret 给服务端注入并本地构造 `checkout.completed` / `refund.created`，覆盖验签与核销全链路。

2026-11-17 实测：`creem-smoke` 6/6、`creem-webhook-smoke` 10/10 全通过（含错签名 401、串单防护、重复投递只发一份授权、退款作废）。

> 注意：脚本里的 webhook payload 必须用建单时落库的**真实 checkout_id**，否则会命中服务端的串单防护而返回 `invalid` —— 这是防护正常工作的表现，不是 bug。

## AaaS 全链路验收脚本（收钱 → 授权 → 执行 → 记账）

`scripts/aaas-e2e.mjs` 一条脚本验证四件事同时成立：Neon 可写、Creem 授权闸门、eve 能执行、OpenRouter 模型能回并记账。

```bash
# 先起完整 Runtime（Node 24，必须显式注入 eve 配置）
export PATH="/c/Program Files/nodejs:$PATH" && unset NODE_OPTIONS
COOLHA_EVE_LOCAL=1 EVE_RUNTIME_ORIGIN=http://127.0.0.1:4274 \
  EVE_INTERNAL_SECRET=coolha-local-eve-proxy npm run dev:all

# 带临时授权跑（closed 模式必须；AAAS_E2E_GRANT=1 会模拟 Creem 付款成功发一份授权）
AAAS_E2E_GRANT=1 node scripts/aaas-e2e.mjs
```

覆盖：钱包登录 → 发授权 → 服务端会话绑授权 → eve 派单 → 模型返回文本 → `agent_usage_ledger` 有真实成本记录。

> 关键：`x-coolha-chat-session` 传的是**我们的**会话号（`e2e_*`），代理记账写的 `session_id` 也是它，不是 eve 的 `wrun_*`。查账本要用前者。
>
> 不带 `AAAS_E2E_GRANT=1` 跑，应看到 `PAYMENT_REQUIRED` —— 这证明 closed 模式闸门正确拦截无授权执行。

2026-11-17 实测：带授权 6/6 通过（模型实回「你好，Coolha 测试回复已收到…」，成本 $0.0000996）；无授权正确返回 402。

## 注意
- Creem 官方 skill 已存到 `~/.creem/skills/`（SKILL.md + HEARTBEAT.md），后续 Creem 相关操作可直接参考。
- 类目风险：Creem 禁售清单含 crypto/NFT，services 属需先联系的 guardrail 类目。测试不受影响，正式开卖前先发邮件 support@creem.io 确认 Coolha 的 Web3/RWA 属性能过审。
- 本地副本 `.env.local` 已被 gitignore，但 `.workbuddy/memory/` 未入库保护 —— 任何凭证值都不要写进会提交的文件。
