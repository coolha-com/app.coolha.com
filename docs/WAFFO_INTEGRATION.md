# Waffo Pancake 支付集成（法币收款 / Merchant of Record）

> 定位：coolha 卖的是 **Agent 执行与交付服务**（$19/次），不是算力也不是 token 额度。
> 法币收款全部由 Waffo Pancake 作 MoR 承载（银行卡 / Apple Pay / Google Pay），
> 我们只负责「发起收银台 → 收到已签名回调 → 核销订单 → 发放服务授权」，不碰持卡数据。
> 三条资金流永不交叉：法币（Waffo）≠ 链上稳定币 ≠ x402。

**状态（2026-11-12）**：SDK 接入、收银台会话、订单账本、Webhook 验签与核销、
**按次服务授权与 token 计量闸门**均已建成并通过端到端验证
（`node scripts/billing-smoke.mjs` / `node scripts/metering-smoke.mjs` → ALL_PASS）。

**计费口径**：一次购买 = 一份服务授权 —— **19 U/次 · 有效期 30 天 · token 价值上限 10 USD**。
额度按**实际推理消耗的 token 价值**扣减；用满或到期即停用，需重新购买。

---

## 1. 数据流

```
用户点「前往结账」
  → POST /api/waffo/checkout（必须登录）
      ├─ 建单：waffo_orders 插入一行 status='pending'，id = WO_<uuid>
      │        （这个 id 同时作为 orderMerchantExternalId 传给 Waffo）
      └─ SDK：client.checkout.authenticated.create({ productId, currency,
                 buyerIdentity, buyerEmail, orderMerchantExternalId, successUrl })
           → 返回 checkoutUrl（带 #token=…，已预填表单）
  → 前端跳转到 Waffo 托管收银台 → 用户付款
  → Waffo POST https://<域名>/webhook
      ├─ 验签：verifyWebhook(rawText, x-waffo-signature)
      ├─ 幂等：event.id 去重 + 状态机（pending → paid）
      ├─ 核销：waffo_orders.status='paid'，记 waffo_order_id / paid_at / 金额
      └─ 发放：agent_service_grants 插入一行（30 天有效 / $10 token 上限）
  → 用户开始任务 → chat_sessions.grant_id 绑定这份授权
  → 每次推理：eve 事件流里的 usage.recorded → agent_usage_ledger
      → 按 OpenRouter 单价换算金额 → 累加 grants.token_used_usd
      → 累加到上限 → grants.status='exhausted' → 后续请求 402
```

**归属靠 `orderMerchantExternalId`**，不用邮箱去猜「谁付的」——所以必须先建单再开收银台。

---

## 2. 三档环境怎么分

| 我们的环境 | 配置文件 | 数据库 | Waffo | Webhook 验签公钥 |
| --- | --- | --- | --- | --- |
| 本地开发 | `.env.local` / `.env.development.local` | **dev** 分支 `ep-gentle-rain` | `test`（沙箱） | `WAFFO_WEBHOOK_TEST_PUBLIC_KEY` |
| Vercel Development / Preview | `.env.preview.local` | **dev** 分支 `ep-gentle-rain` | `test`（沙箱） | `WAFFO_WEBHOOK_TEST_PUBLIC_KEY` |
| Vercel Production | `.env.production.local` | **main** 分支 `ep-tiny-wildflower` | `prod`（真实收款） | `WAFFO_WEBHOOK_PROD_PUBLIC_KEY` |

同步到云端：`node scripts/sync-vercel-env.mjs`（空值不推、按目标分组 PATCH/新建、
自动清掉 `AI_GATEWAY_API_KEY` 与纯本地的 `COOLHA_EVE_LOCAL`）。
**改完 env 必须 Redeploy 才生效。**

---

## 3. 环境变量

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `WAFFO_MERCHANT_ID` | ✅ | 商户 ID（`MER_…`）。**不是 storeId** |
| `WAFFO_PRIVATE_KEY` | ✅ | RSA 私钥。SDK 自动归一化 PEM / PKCS#1 / 字面 `\n` / 裸 base64 |
| `WAFFO_STORE_ID` | ✅ | 店铺 ID（`STO_…`），运行时值 |
| `WAFFO_ENVIRONMENT` | — | `test`（默认）/ `prod`，决定用哪把公钥验签 |
| `WAFFO_PRODUCT_ID` | — | 一次性商品 ID（默认 `PROD_4yvNFDfR3pynj7PmAooWSG` = $19.00 USD） |
| `WAFFO_CURRENCY` | — | 结算币种，默认 `USD` |
| `WAFFO_WEBHOOK_TEST_PUBLIC_KEY` | — | Test 环境验签公钥（单行，见 §6） |
| `WAFFO_WEBHOOK_PROD_PUBLIC_KEY` | — | Prod 环境验签公钥 |

公开模板见 `.env.local.example`（密钥留空）。**私钥只存在于服务端**。

> ⚠️ 生产凭据是**另一套**：生产的 API 私钥 / 商品 ID / 验签公钥都要从 Dashboard 的
> **生产**模式复制，test 的值不能直接用。当前 `.env.production.local` 里这三项留空，
> 生产收款会如实返回「支付服务未配置」而不是假成功。

---

## 4. Dashboard 的 Webhook 怎么配（设置 → Webhooks）

界面长这样（截图对照）：

| 界面元素 | 该怎么填 | 说明 |
| --- | --- | --- |
| 橙色横幅「您正在编辑测试模式（TEST）的 Webhook」 | 知道就行 | Dashboard 里 **test / prod 是两套独立配置**，改 test 不会影响生产投递 |
| Webhook URL | `https://app.coolha.com/webhook` | 走**根路由** `/webhook`，不是 `/api/webhook` |
| 格式 Format | **Raw** | 只有 Raw 带 RSA-SHA256 签名；聊天平台格式没有签名，验签必挂 |
| 签名密钥 | 平台级 `RSA Public Key` | Test / Production 各一把，**别拿错环境**（§3 表） |
| 已启用事件 | `所有事件类型 (15)` 即可 | 我们只处理 `order.completed` 与 `refund.succeeded`，其余事件忽略 |
| 「发送测试事件」按钮 | 配好后点一次 | 会立刻往该 URL 发一条测试事件，用它验证连通性 |
| 下方事件列表 | 看投递记录 | 正常会显示状态与重试次数；**0 个事件 = 从没收到过投递** |

**两个必须知道的坑**

1. **一个环境只能有一个 URL**：Dashboard 的 TEST webhook 现在指向生产域名
   `app.coolha.com/webhook`。本地联调要换成隧道地址（§5），预览要用预览域名 ——
   两者会互相覆盖，需要来回改。
2. **验签环境必须匹配**：生产部署跑 `WAFFO_ENVIRONMENT=prod`，只认生产公钥；
   而 test 签名的测试事件会被**401 拒掉**。所以本地联调请把 TEST webhook 的 URL
   指向隧道/预览域名；生产域名留给 PROD webhook。

**Webhook 公钥必须单行**：多行 PEM 会被 `.env` 解析器截断成 `-----BEGIN PUBLIC KEY-----`，
SDK 归一化直接抛错，验签 100% 失败。把换行写成字面 `\n`（SDK 会还原）。

---

## 5. 本地联调

Waffo 是**入站**回调，localhost 收不到，必须用隧道（**ngrok / cloudflared，不要用 localtunnel**——它会剥离自定义头，`X-Waffo-Signature` 永远到不了）：

```bash
ngrok http 3000
# 把 https://xxx.ngrok-free.app/webhook 填进 Dashboard 的 TEST Webhook URL
# 触发：Dashboard 点「发送测试事件」，或用测试卡做一笔真实购买
```

测试卡：`4576750000000110`（成功）/ `4576750000000220`（失败）。

回看请求：ngrok 自带 inspector `http://127.0.0.1:4040`，确认 `X-Waffo-Signature` 头存在。

不想走收银台时，**测试模式可以直接发一份授权**（仅 `WAFFO_ENVIRONMENT=test` 时可用，
生产调用一律 403）：

```bash
curl -X POST http://localhost:3000/api/agents/credits/test-grant   # 需登录态
```

---

## 6. 已踩的坑（全部真实踩过）

| 坑 | 症状 | 正解 |
| --- | --- | --- |
| **多行 PEM 写进 .env** | 值被截断成 `-----BEGIN PUBLIC KEY-----`，SDK 归一化直接抛错，验签 100% 失败 | **必须单行**：把换行写成字面 `\n`（SDK 会还原） |
| **变量名写错** | `WAFFP_WEBHOOK_PUBLIC_KEY` / `WAFFO_WEBHOOK_KEY` SDK 根本不认，只能靠内置公钥兜底 | 只用 `WAFFO_WEBHOOK_{TEST,PROD}_PUBLIC_KEY` / `WAFFO_WEBHOOK_PUBLIC_KEY` |
| **`t` 用秒级时间戳** | 验签卡在「Webhook timestamp outside tolerance window」 | `t` 是**毫秒**（SDK 用 `Date.now() - t` 算年龄） |
| **用 `req.json()` 读 body** | 空白被重排，签名必然对不上 | 必须 `await req.text()` 拿原始文本 |
| **先记幂等再处理** | 处理失败时 Waffo 的重投被去重挡掉，订单永远核销不了 | **处理成功后才记** event id；真正的幂等靠状态机 |
| **用 Origin 拼 successUrl** | 可被跨站伪造，回跳被劫持 | 只用请求自身的 Host |
| **只改 `WAFFO_ENVIRONMENT` 不换 key** | 验签全线失败 | prod 必须配套生产私钥 + 生产公钥 |
| **`SUM(text)`** | Postgres `42883 function sum(text) does not exist` | 金额列是 text，先 `amount::numeric` 再 `SUM` |

---

## 7. 代码位置

| 文件 | 职责 |
| --- | --- |
| `src/lib/waffo/client.ts` | SDK 单例、环境变量校验、验签参数（`server-only`） |
| `src/lib/neon/waffo.ts` | 订单账本读写、幂等事件表 |
| `src/app/api/waffo/checkout/route.ts` | 建单 + 开收银台会话（需登录） |
| `src/app/webhook/route.ts` | 回调入口：验签 → 幂等 → 核销 → **发放服务授权** |
| `src/lib/neon/agent-billing.ts` | 授权（发放/作废/查找/额度累加）与用量账本 |
| `src/lib/agents/pricing.ts` | OpenRouter 模型单价（token → 美元） |
| `src/lib/agents/usage-meter.ts` | 从 eve 事件流解析 `usage.recorded` 并记账 |
| `src/app/api/eve/v1/[...path]/route.ts` | 受控代理：付费闸门 + 流式计量 |
| `src/app/api/agents/credits/route.ts` | 额度状态（前端展示用） |
| `src/app/api/agents/credits/test-grant/route.ts` | **仅测试模式**：直接发一份授权 |
| `src/components/agents/OneTimePurchase.tsx` | 购买 UI（客户端组件，调上面的 API） |
| `db/migrations/014_waffo_orders.sql` | `waffo_orders` + `waffo_webhook_events` |
| `db/migrations/015_agent_service_grants.sql` | `agent_service_grants` + `agent_usage_ledger` |

---

## 8. 切生产前必做

1. 店铺通过 **KYB 审核**（否则 prod webhook 不投递）。
2. 复制**生产**凭据到 `.env.production.local` 与 Vercel Production：
   `WAFFO_PRIVATE_KEY` / `WAFFO_PRODUCT_ID` / `WAFFO_WEBHOOK_PROD_PUBLIC_KEY`，
   并把 `WAFFO_ENVIRONMENT` 设为 `prod`（已是）。
3. 商品要 **publish** 到生产（test 版的商品不会自动上生产）。
4. 生产 webhook URL 指向稳定域名，**绝不填临时隧道地址**。
5. 三条资金流仍要隔离：不要在同一处混用法币与稳定币收款。

## 9. 尚未建成（下一步决策）

- **公网可达的 eve Runtime**：Agent 执行目前只有本机 `:4274`。预览/生产部署需要一台
  公网可达的 Runtime，并配 `EVE_RUNTIME_ORIGIN` + `EVE_INTERNAL_SECRET`，
  否则 `/api/eve/v1/*` 一律 503。
- **超额兜底**：拿不到 OpenRouter 单价时成本记 NULL（不编造），但也不会扣减额度 ——
  需要一条「单价缺失即按上限保守处理」的策略。
- **退款与已消耗额度的对账**：当前退款作废授权，账本里的历史消耗保持原样（可审计，不回滚）。
