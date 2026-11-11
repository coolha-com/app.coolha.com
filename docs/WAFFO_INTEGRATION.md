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
| 橙色横幅「您正在编辑测试模式（TEST）的 Webhook」 | 知道就行 | Dashboard 按环境分别编辑：现在编辑的是 **TEST 条目**（`testMode=true`），切到生产模式才是 PROD 条目 |
| Webhook URL | `https://app.coolha.com/webhook` | 走**根路由** `/webhook`，不是 `/api/webhook` |
| 格式 Format | **Raw** | 只有 Raw 带 RSA-SHA256 签名；聊天平台格式没有签名，验签必挂 |
| 签名密钥 | 平台级 `RSA Public Key` | Test / Production 各一把，**别拿错环境**（§3 表） |
| 已启用事件 | `所有事件类型 (15)` 即可 | 我们只处理 `order.completed` 与 `refund.succeeded`，其余事件忽略 |
| 「发送测试事件」按钮 | 配好后点一次 | 会立刻往该 URL 发一条**样例 payload**，**不会关联到真实测试订单**——只验证连通性，不验证订单归属 |
| 下方事件列表 | 看投递记录 | 正常会显示状态与重试次数；**0 个事件 = 从没收到过投递** |

**一个必须知道的坑：验签环境必须匹配**

Waffo 的 webhook 是**独立条目**，每条带自己的 `testMode` 标志（`store_webhooks` 表）。
同一个店铺**可以同时注册多条 http 通道的 webhook**：一条 `testMode=true`（沙箱投递）、
一条 `testMode=false`（正式投递）。**它们可以指向同一个 URL** —— 这不是冲突，
而是**必须这么做**：同一个生产域名要同时接沙箱和正式两种投递。

查自己店铺注册了哪些条目：

```graphql
query { store(id: "STO_xxx") { storeWebhooks { id url events testMode } } }
```

> ⚠️ 列表 webhook **只有 GraphQL 一个入口**（`Store.storeWebhooks`），
> 没有 REST 列表接口。

真正的问题是**验签用哪把公钥**：

| 部署 | `WAFFO_ENVIRONMENT` | 事件来源 | 验签策略 |
| --- | --- | --- | --- |
| 本地 / 预览 | `test` | 沙箱事件（test 签名） | 两把公钥都配，SDK 自动回退 |
| 生产 | `prod` | 正式事件（prod 签名） | 同上 |

如果生产部署显式只认 prod 公钥，那么**沙箱事件打到生产域名会被 401 拒掉** ——
这不是「URL 填错」，是「公钥选错」。解法见 §4.1。

**Webhook 公钥必须单行**：多行 PEM 会被 `.env` 解析器截断成 `-----BEGIN PUBLIC KEY-----`，
SDK 归一化直接抛错，验签 100% 失败。把换行写成字面 `\n`（SDK 会还原）。

---

## 4.1 验签：让同一份代码同时认沙箱与正式事件

SDK 的 `verifyWebhook` 行为（`@waffo/pancake-ts` 实测源码）：

- 传 `options.environment` → **只用该环境那把公钥**验签，另一把完全不试。
- **不传** `options.environment` → 先试 prod 公钥，失败再试 test 公钥，两把都不过才抛错。

所以正确做法是**不传 environment**，让 SDK 自动回退。但**不能只靠 SDK 回退**：
只配了一把公钥时，回退的那把会落到 SDK 内置公钥上（平台级默认 key）。
如果平台轮换过 key，内置公钥就失效了 → 验签必挂。

推荐做法（也是本项目 `src/lib/waffo/client.ts` 的做法）：

```ts
// 两个环境的公钥都配齐（env 文件里都是单行 PEM）
WAFFO_WEBHOOK_TEST_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----
WAFFO_WEBHOOK_PROD_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----
```

SDK 的取钥顺序是：
`options.publicKey` → `config.webhookPublicKey` → `WAFFO_WEBHOOK_{TEST|PROD}_PUBLIC_KEY`
→ `WAFFO_WEBHOOK_PUBLIC_KEY` → SDK 内置公钥。

两把都配齐后，不传 `environment` 就能自动认两种签名，**生产域名可以同时接沙箱和正式投递**，
本地也不用改 URL 来回切。

> ⚠️ 如果一定要按环境区分（比如生产只认 prod 公钥、拒绝沙箱事件），
> 那就显式传 `environment: "prod"` —— 但这样**沙箱事件必须指向别的 URL**，
> 且那套环境必须自己配好 test 公钥。默认推荐前者（自动回退）。

---

## 4.2 本地开发的 webhook 路由怎么填（三种场景，选一种）

先说结论：**沙箱 webhook 应该指向「预览部署」，不要指向 localhost**。

### 场景 A（推荐 · 默认）：沙箱 webhook → 预览部署

```bash
node scripts/waffo-webhook.mjs set-test "https://appcoolhacom-git-agent-coolha.vercel.app/webhook"
```

为什么这样最好：

| | 预览部署 | 本地 localhost |
| --- | --- | --- |
| 有 `/webhook` 路由 | ✅ `/agent` 分支上有 | ✅ 有 |
| 公网可达 | ✅ | ❌ **Waffo 投递不到** |
| 数据库 | dev 分支 | dev 分支（**同一个**） |
| Waffo 环境 | test 沙箱 | test 沙箱 |

关键洞察：**本地和预览用的是同一个 dev 数据库**。所以订单核销、授权发放的结果，
本地刷新就能看到 —— 不需要隧道，也不需要在本地跑收银台回调。

> ⚠️ 前提：`app.coolha.com`（生产域名）走的是 `main` 分支，**上面没有 `/webhook` 路由**。
> 把沙箱 webhook 指到生产域名会得到 200 但返回 HTML 首页，事件实际**没被处理**。
> 这就是本项目一度「支付成功但订单没核销」的原因。

### 场景 B：一定要在本地收回调（调试 webhook 处理逻辑）

Waffo 是**入站**回调，localhost 收不到，必须用隧道
（**ngrok / cloudflared，不要用 localtunnel** —— 它会剥离自定义头，`X-Waffo-Signature` 永远到不了）：

```bash
ngrok http 3000
# 拿到 https://xxx.ngrok-free.app 后：
node scripts/waffo-webhook.mjs add-test "https://xxx.ngrok-free.app/webhook"
```

**关键点：可以再加一条条目，不用改原来的。** 实测 `webhooks.add` 允许同 store 下
多条 `channel=http` + `testMode=true` 的条目并存（各投各的），所以：

- 场景 A 的预览条目**留着不动**（保证随时能验证线上链路）
- 场景 B 的隧道条目**临时加**，调试完删掉

```bash
node scripts/waffo-webhook.mjs list      # 看当前所有条目
node scripts/waffo-webhook.mjs remove <webhookId>   # 删掉临时条目
```

回看请求：ngrok 自带 inspector `http://127.0.0.1:4040`，确认 `X-Waffo-Signature` 头存在。

### 场景 C：完全不走收银台（最快的本地验证）

测试模式可以直接发一份授权（仅 `WAFFO_ENVIRONMENT=test` 时可用，生产调用一律 403）：

```bash
curl -X POST http://localhost:3000/api/agents/credits/test-grant   # 需登录态
```

这条路径绕过 Waffo 全部流程，适合只想验证「额度 → 付费墙 → 能开始任务」这段逻辑。

### 本地三种场景速查

| 你想验证什么 | 填哪 | 怎么触发 |
| --- | --- | --- |
| 订单核销 + 授权发放（完整链路） | 预览部署 | 在**预览站**买一笔沙箱支付，本地刷新看 dev 库 |
| webhook 处理逻辑（验签/幂等/mode） | 隧道地址 | 本地跑 `dev:all`，在预览站买一笔（会同时投到本地） |
| 额度与付费墙 | 不用填 | `POST /api/agents/credits/test-grant` |

> 💡 场景 A 和 B 可以**同时开**：沙箱事件会投到两个地址。
> 只想看其中一个的结果时，看 `webhookDeliveries` 里对应 URL 的 `httpStatus` 就知道是谁处理了。

---

## 5. 沙箱测试卡与投递记录

测试卡（官方文档给的沙箱卡号，任意未来有效期 + 任意 3 位 CVC）：

| 结果 | 卡号 |
| --- | --- |
| 成功付款 | `4576 7500 0000 0110` / `2226 9000 0000 0110` / `4001 7000 0000 0110` / `2226 9300 0000 0110` |
| 拒绝付款 | `4576 7500 0000 0220` / `2226 9000 0000 0220` / `4001 7000 0000 0220` / `2226 9300 0000 0220` |

本地怎么填 webhook URL，见 **§4.2**。

### 5.1 查投递记录（确认事件到底有没有到）

```graphql
query { webhookDeliveries { id status httpStatus eventType webhookUrl attemptCount createdAt } }
```

`status` / `httpStatus` 能直接看出是「没连上」「401 验签失败」还是「200 但没归因」。
（本项目当前状态：**0 条投递记录**——沙箱从没发生过一次支付。）

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

## 8. 切生产前必做（附账号现状实测）

账号现状（2026-11-12 通过 GraphQL 实测）：

| 项目 | 现状 | 影响 |
| --- | --- | --- |
| API Key | **只有 1 把**：`KEY_4IXXvtCvahNJc9AgYo2UMG`「本地电脑测试」，`environment=test` | 生产**没有私钥** → 生产收款必然失败 |
| 商品 | `PROD_4yvNFDfR3pynj7PmAooWSG`「智能体服务 按次调用付费」，`status=active`，`hasProdVersion=false` | 沙箱可用；**未 publish 到生产** |
| Webhook | 1 条：`http` 通道 → `https://app.coolha.com/webhook`，`testMode=true`，订阅 15 个事件 | 沙箱投递可用；**没有 PROD 条目** |
| 投递记录 | **0 条** | 从没发生过一次支付，链路未经真实投递验证 |
| 验签公钥 | Dashboard TEST 公钥 == SDK 内置 TEST 公钥（密码学比对一致） | 平台**未轮换** webhook key；内置 PROD 公钥即为当前生产公钥 |

必做清单：

1. 店铺通过 **KYB 审核**（否则 prod webhook 不投递）。
2. 在 Dashboard **生产模式**新建一把 API Key，把它的私钥填进
   `.env.production.local` 与 Vercel Production 的 `WAFFO_PRIVATE_KEY`
   （生产私钥与测试私钥是**两把不同的 key**）。
3. 用生产 key 调 `publish-product` 把商品同步到生产（**单向操作**，不需要 `X-Environment` 头）：

   ```bash
   curl -X POST https://api.waffo.ai/v1/actions/onetime-product/publish-product \
     -H "Content-Type: application/json" \
     -H "X-Merchant-Id: MER_xxx" \
     -H "X-Timestamp: 1705312200" \
     -H "X-Signature: BASE64_RSA_SHA256_SIGNATURE" \
     -d '{"id":"PROD_4yvNFDfR3pynj7PmAooWSG"}'
   ```

   publish 后生产商品 ID 可能变化 → 记得同步更新 `WAFFO_PRODUCT_ID`。
4. 在 Dashboard **生产模式**再注册一条 webhook（`testMode=false`），URL 同样填
   `https://app.coolha.com/webhook`。**两条条目指向同一 URL 是正常的**，
   验签靠「两把公钥都配」区分（§4.1）。
5. 生产 webhook URL 指向稳定域名，**绝不填临时隧道地址**。
6. 三条资金流仍要隔离：不要在同一处混用法币与稳定币收款。

> 已确认可省力的一步：生产验签公钥**不用从 Dashboard 手工复制**——
> SDK 内置的 `PROD_PUBLIC_KEY` 就是当前生产公钥（因为内置 TEST 与 Dashboard 当前 TEST
> 完全一致 → 平台没轮换过 key）。`scripts/gen-env-files.mjs` 已自动填好。
> 万一平台轮换过 key（内置 TEST ≠ env 里的 TEST），自动填法就会失效，
> 那时才需要去 Dashboard 复制两把公钥。用 `node scripts/check-waffo-keys.mjs` 一眼可辨。

## 9. 尚未建成（下一步决策）

- **公网可达的 eve Runtime**：Agent 执行目前只有本机 `:4274`。预览/生产部署需要一台
  公网可达的 Runtime，并配 `EVE_RUNTIME_ORIGIN` + `EVE_INTERNAL_SECRET`，
  否则 `/api/eve/v1/*` 一律 503。
- **超额兜底**：拿不到 OpenRouter 单价时成本记 NULL（不编造），但也不会扣减额度 ——
  需要一条「单价缺失即按上限保守处理」的策略。
- **退款与已消耗额度的对账**：当前退款作废授权，账本里的历史消耗保持原样（可审计，不回滚）。
