# 架构决策：账号体系与免费/付费分层（ADR）

- 日期：2026-10-16
- 状态：已决议（四个决策点见第八节；档位定价与权益矩阵见 `docs/PRICING_AND_ENTITLEMENTS.md`；P0 已实施）
- 背景：Chat（原 Playground）已可匿名使用、BYOK 已落地、钱包登录（SIWE）已建但未被任何业务消费。本文回答：① 连接钱包与登录各带来什么；② 账号体系怎么设计；③ 付费与免费的功能边界如何切（且必须满足 Vercel AUP）。

---

## 一、现状核实（2026-10-16 实测代码，非推测）

| 事实                  | 证据                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 存在**三套**身份机制，互相独立   | ① Reown AppKit 钱包连接（纯客户端）；② SIWE 自建会话 `/api/wallet-auth/*` + `wallet_users/wallet_nonces/wallet_sessions`；③ Neon Managed Auth 邮箱体系 `/api/auth/*`（`neon_auth.user`） |
| **连接钱包 ≠ 登录**       | 连接只把地址交给前端（wagmi `useAccount`），服务端无任何凭据；登录需签名 → 服务端验签 → `httpOnly` Cookie（`coolha_wallet_session`，7 天，可撤销）                                                         |
| **登录后不解锁任何功能**      | 全仓 grep：业务路由中**没有任何一处**读取钱包会话。`ai_gateway_usage.wallet_address` 列已建但无人写入                                                                                           |
| **匿名即可烧我们的额度**      | `/api/compute/playground` 无身份门禁，仅 IP 限流 20 次/分钟（`checkRateLimit(clientKeyOf(req))`）                                                                                |
| 限流是**进程内 Map**，不跨实例 | `const rateHits = new Map()`；N 个 Lambda 实例 = 实际 N×20 次/分钟；换 IP/VPN 即绕过                                                                                             |
| 用户数据全在浏览器           | `coolha.conversations`（最多 50 条）、`coolha.connections`（含 API Key）都在 localStorage，服务端无副本                                                                              |
| `/api/chat` 是裸露的成本洞 | 该 demo 路由直接 `streamText({ model: "openai/gpt-5.5" })`，**无鉴权、无限流、无人引用**                                                                                             |
| 已有前置决策              | `docs/ARCHITECTURE_IDENTITY_BILLING.md`：内部 ID = `user_id`，EVM 地址是身份锚点；计费地址与身份地址分离；不使用智能账户                                                                          |

### 一句话结论

> **当前「连不连钱包、登不登录」在产品上零差别**——登录态建好了但没人消费，匿名反而能无限烧额度。这是成本与产品双重缺陷，必须收敛。

---

## 二、身份模型：四态而非二态

不要把问题想成「登录 / 未登录」两态，实际是**四态**：

| 层级           | 触发条件                | 服务端凭据                                | 能证明什么                    |
| ------------ | ------------------- | ------------------------------------ | ------------------------ |
| **L0 匿名**    | 打开网页                | 无                                    | 什么都不能证明                  |
| **L1 已连接钱包** | AppKit 连接           | **无**（仅前端）                           | 只证明"浏览器里装了个钱包"，可随时断开、可谎报 |
| **L2 已登录**   | SIWE 签名成功           | `coolha_wallet_session` Cookie + 会话表 | 密码学证明"控制该地址"；服务端可撤销、可审计  |
| **L3 订阅用户**  | L2 + 有效 entitlement | 同上 + 订阅记录                            | 在 L2 之上叠加权益              |

**关键区分**：L1→L2 是**唯一有安全意义的跨越**。UI 上不要把"连接钱包"和"已登录"混为一谈——连接只是拿到签名工具，签名才产生身份。

---

## 三、不登录（停留在 L0/L1）的实际影响

这是要**明确告知用户**的，也是登录的唯一正当理由：

| 维度   | 不登录                     | 登录后                |
| ---- | ----------------------- | ------------------ |
| 会话历史 | 仅本机 localStorage        | 服务端持久化，跨设备/换浏览器可恢复 |
| 数据风险 | 清缓存、换设备、无痕模式 → **全部丢失** | 与设备解耦              |
| 模型连接 | 同上，Key 与连接配置随本机走        | 可同步（注意：见下方红线）      |
| 订阅权益 | **无法绑定** → 换浏览器就得重新买    | 跟随身份               |
| 用量审计 | 无                       | 可查自己的调用/成本明细       |
| 滥用追溯 | 无法封禁具体人                 | 可按 `user_id` 限流、封禁 |

**红线**：即便登录，也**绝不把用户的第三方 API Key 上传到服务端**。同步的是「连接元信息（别名、baseURL、模型列表）」，密钥本体仍留浏览器——这既是 AUP 要求（禁转售/转让第三方 provider key），也是我们既定的产品承诺。

---

## 四、免费 vs 付费：卖什么（AUP 安全边界）

前提（已定）：**我们卖软件订阅，不卖模型算力/token**。因此付费墙**不能**是"给你更多 token/解锁更强模型由我们供给"——那是转售，撞 Vercel AUP。付费解锁的必须是**软件能力**。

### 免费（L0/L1/L2）

- 免费模型对话（**有配额**，见第五节）
- BYOK 自定义连接：**上限 2 个**
- 会话历史：本地 50 条 / 服务端保留 30 天、最近 20 条
- 单会话对话、图片理解、基础 Markdown 渲染
- 用量看板：仅本次会话维度

### 付费（L3）— 全是软件特性

| 能力                                    | 说明                               |
| ------------------------------------- | -------------------------------- |
| **无限 BYOK 连接** + 分组/别名/启用禁用           | 软件配置能力                           |
| **服务端会话历史**：无限条、永久保留、全文检索             | 存储与检索能力                          |
| **跨设备同步**                             | 同上                               |
| **导出**：Markdown / JSON / 批量导出         | 数据可携能力                           |
| **用量与成本看板**：多连接聚合、按模型/按天/按月、成本归因      | 可观测能力                            |
| **路由策略**：fallback 顺序、超时、重试、单次成本上限、并发数 | 编排能力                             |
| **系统提示词 / Persona 预设库**               | 模板能力                             |
| **Prompt 模板与变量**                      | 同上                               |
| **多模型并排对比**（同一问题发给 N 个模型）             | 交互能力                             |
| **移动端 / API / Webhook / MCP 出口**      | 用**用户自己的 key** 在用户自己的环境调用——卖的是软件 |
| 团队成员与共享空间                             | 协作能力                             |

### 一条必须写进定价页的话术

> 订阅解锁的是**客户端与工作流能力**；模型推理费用由你自己的 API Key 承担，我们不代售任何模型算力。

### 发行版的"免费额度"怎么摆

免费模型额度（我们出钱）定位为**获客成本**，不是产品功能。因此：

- 明示"免费额度由 Coolha 赞助，额度与模型随时可能调整"
- 超限后提示「登录继续 / 接自己的 Key 无限用」——**不是**付费墙
- 设全局熔断开关（env 变量 / DB 标志），成本异常时可一键关闭免费通道

---

## 五、限流与额度（成本止血，最高优先级）

现状 20 次/分钟/IP 且进程内不共享 → 形同虚设。建议：

| 层级        | 限额建议                              | 依据键       |
| --------- | --------------------------------- | --------- |
| L0 匿名     | **不允许**走我们的免费通道（只能 BYOK），或 5 次/小时 | IP + 匿名指纹 |
| L1/L2 未订阅 | 30 次/天（或等值 credit 上限）             | `user_id` |
| L3 订阅     | 200 次/天                           | `user_id` |
| 全局        | 日成本上限（USD），触顶熔断                   | —         |

**实施建议**：

- 换掉进程内 Map → **Upstash Redis + `@upstash/ratelimit`**（Vercel Marketplace 一键集成，免费额度足够起步，跨实例共享，支持滑动窗口/令牌桶）。
- 若暂不引入 Redis，退而求其次：写 `rate_limit_events` 表按 `(subject, window_start)` 计数——会增 DB 写压力，仅作过渡。
- **立即处理 `/api/chat`**：该 demo 路由无鉴权无限流且直连付费模型 `openai/gpt-5.5`，等于公开水龙头。建议删除或加与 playground 相同的门禁。

---

## 六、Schema 提案（005 号迁移）

```sql
-- 005: 账号体系（users / identities / entitlements / 服务端会话存储）

-- 内部唯一身份（与地址解耦）
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'active'      -- active | suspended
);

-- 外部身份锚点（一个 user 可有多个地址）
CREATE TABLE IF NOT EXISTS user_identities (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL,                          -- 'evm_signing' | 'email'
  address    text NOT NULL,                          -- 小写地址 / 邮箱
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, address)
);
CREATE INDEX IF NOT EXISTS idx_user_identities_user ON user_identities (user_id);

-- 订阅权益（付费墙的唯一判据）
CREATE TABLE IF NOT EXISTS entitlements (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan        text NOT NULL DEFAULT 'free',          -- free | pro | team
  status      text NOT NULL DEFAULT 'inactive',      -- active | past_due | canceled | inactive
  source      text NOT NULL DEFAULT 'none',          -- none | crypto | stripe | manual
  current_period_end timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 服务端会话历史（登录后才有；密钥永不上行）
CREATE TABLE IF NOT EXISTS chat_threads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL DEFAULT '',
  model      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_threads_user ON chat_threads (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         bigserial PRIMARY KEY,
  thread_id  uuid NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role       text NOT NULL,
  parts      jsonb NOT NULL,                         -- AI SDK UIMessage parts
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages (thread_id, id);

-- 计费地址（与身份地址分离；只有充值来源语义，无鉴权权）
CREATE TABLE IF NOT EXISTS billing_addresses (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  address text NOT NULL,
  label   text,
  PRIMARY KEY (user_id, address)
);
```

**迁移路径**：`wallet_users.address` → `user_identities(kind='evm_signing')`；业务外键一律指向 `users.id`。现有 `wallet_sessions.address` 保留，查询时 join 到 `user_id`。

---

## 七、实施路线

| 阶段          | 内容                                                          | 优先级 |
| ----------- | ----------------------------------------------------------- | --- |
| **P0 止血**   | ① 删除/门禁 `/api/chat`；② 免费通道要求登录；③ 限流换 Upstash 并按 `user_id` 计 | 立即  |
| **P1 身份落地** | 迁移 005；`users`/`user_identities` 与 SIWE 打通；业务路由统一读会话        | 紧随  |
| **P2 数据上云** | 登录后会话历史写 `chat_threads/chat_messages`，本地列表与服务端合并            | 中   |
| **P3 付费墙**  | `entitlements` + 特性开关中间件（服务端判定，前端只做展示）                      | 中   |
| **P4 收款**   | 链上订阅（稳定币月付 / 持有资产门控）优先于 Stripe——契合 Web3 用户且无地域限制            | 后   |



---

## 八、待确认决策点 → **已决议（2026-10-16）**

| # | 问题 | 决议 |
|---|---|---|
| 1 | 匿名能否用免费模型？ | **不能**。免费通道需登录，登录后按 token 计量 + 每日请求上限 |
| 2 | 付费档位数量 | **四档**：Free $0 / Plus $6 / Pro $10 / Ultra $30（USD/月） |
| 3 | 收款方式 | **仅链上**，USDC / USDT 稳定币结算，不接 Stripe |
| 4 | 免费额度计量 | **按 token**（input + output），不按次数 |

档位定价、权益矩阵、链上收款匹配与状态机详见 **`docs/PRICING_AND_ENTITLEMENTS.md`**（本文第四节"单档 pro"的表述已被其取代）。

> 补充：决议 1 只禁匿名使用**免费模型**（我们赞助的算力）。匿名仍可添加自己的模型与 Key 对话（BYOK 走浏览器直连，不经我们服务端，不计量不限流）。

## 九、复核条件

- 若 Vercel AUP / AI Product Terms 条款更新：重新评估"免费额度由我们出钱"这一形态是否仍属 §8.3 认可范围。
- 若引入 Redis：限流实现从 DB 计数切换过去，`rate_limit_events` 表废弃。
- 若出现真实的多地址归属需求：提前 `users`/`user_identities` 迁移与链接流程。
