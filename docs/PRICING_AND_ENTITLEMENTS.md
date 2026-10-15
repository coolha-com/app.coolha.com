# 定价、权益与链上计费设计

- 日期：2026-10-16
- 状态：**档位与权益已定**（计费工程实现为 Phase 2）
- 上游文档：`docs/ACCOUNT_TIER_DESIGN.md`（身份四态模型）、`docs/ARCHITECTURE_IDENTITY_BILLING.md`（身份/计费地址分离）、`docs/PLAYGROUND_ACCESS_AND_BILLING_PLAN.md`（不转售算力）

---

## 一、已确认决策

| # | 决策 | 结论 |
|---|---|---|
| 1 | 匿名能否用免费模型 | **不能**。免费模型通道需登录；登录后按 token 计量，另设每日请求上限 |
| 2 | 档位数量 | **四档**：Free $0 / Plus $6 / Pro $10 / Ultra $30（USD/月） |
| 3 | 收款方式 | **仅链上**，USDC / USDT 稳定币结算，不接 Stripe |
| 4 | 免费额度计量维度 | **token**（input + output），不按次数 |

---

## 二、档位与价格

| 档位 | 月价 (USD) | 定位 |
|---|---|---|
| **Free** | $0 | 体验与 BYOK 自用；赞助额度是获客成本 |
| **Plus** | $6 | 个人轻度用户：要同步、要导出、要多连接 |
| **Pro** | $10 | 个人重度用户：要检索、要对比、要路由策略 |
| **Ultra** | $30 | 专业/小团队：要 API 出口、要席位、要优先级 |

结算：以 **USD 计价**，支付时按 USDC/USDT 折算（稳定币 ≈ 1:1，取 2 位小数；若偏离 >1% 则用 Chainlink 等预言机价并在支付页明示折算率）。

---

## 三、赞助额度（免费模型，Coolha 出钱的部分）

计量口径：**input_tokens + output_tokens**（AI SDK `usage`），UTC 自然日窗口，每日 00:00 UTC 重置。

| 档位 | 每日 token 上限 | 每日请求上限（防刷硬顶） |
|---|---|---|
| Free | 300 K | 30 |
| Plus | 1.5 M | 120 |
| Pro | 6 M | 400 |
| Ultra | 25 M | 1200 |

说明：
- **双上限**：token 是计量与档位对比维度，请求数是短时防刷兜底（长上下文单请求可能一次吃掉全天 token）。
- **超限行为**：返回 `429 QUOTA_EXCEEDED`，响应带 `{ limit, used, resetAt }`；UI 提示「额度已用完，可切换自己的模型继续」。**不是付费墙**——超限的正确解法是 BYOK，不是升级。
- **BYOK 不计量、不限流**：那是用户自己的 Key 与自己的钱，我们没有理由也没有权利限制。
- **全局熔断**：保留 env/DB 级别的 kill switch 与日成本上限，异常时一键关闭免费通道（防止 availability fallback 误扣 Vercel Credits）。
- 定价页必须明示：「免费模型额度由 Coolha 赞助，额度与可用模型可能随时调整。」

---

## 四、权益矩阵（付费买的是软件能力）

> 红线：**付费不解锁"更多算力"**。解锁的是客户端能力、存储、可观测、编排与出口。

### 4.1 核心对话

| 能力 | Free | Plus | Pro | Ultra |
|---|---|---|---|---|
| 免费模型（赞助额度） | 300K/天 | 1.5M/天 | 6M/天 | 25M/天 |
| 自定义模型连接（BYOK） | 2 | 5 | 15 | 无限 |
| 图片 / 文件理解 | ✓ | ✓ | ✓ | ✓ |
| 深度思考（reasoning） | ✓ | ✓ | ✓ | ✓ |
| 网页搜索 | — | 自带 Key | 自带 Key | 自带 Key + 每月赠 100 次托管检索 |
| 排队优先级 | 低 | 普通 | 高 | 最高 |

### 4.2 记忆与历史

| 能力 | Free | Plus | Pro | Ultra |
|---|---|---|---|---|
| 本机历史 | 50 条 | 50 条 | 50 条 | 50 条 |
| 服务端历史保留 | — | 90 天 | 365 天 | 永久 |
| 服务端历史条数 | — | 500 | 5 000 | 无限 |
| 跨设备同步 | — | ✓ | ✓ | ✓ |
| 全文检索 | — | — | ✓ | ✓ |
| 导出 | — | 单条 MD | 批量 MD + JSON | 批量 + 定时 + CSV |

### 4.3 工作流

| 能力 | Free | Plus | Pro | Ultra |
|---|---|---|---|---|
| Persona / 系统提示词预设 | 1 | 10 | 无限 | 无限 |
| Prompt 模板库 | — | 5 | 无限 | 无限 |
| 多模型并排对比 | — | — | 2 路 | 4 路 |
| 路由策略（fallback / 超时 / 重试 / 单次成本上限） | — | — | ✓ | ✓ |
| 并发会话 | 1 | 3 | 10 | 无限 |

### 4.4 可观测与出口

| 能力 | Free | Plus | Pro | Ultra |
|---|---|---|---|---|
| 用量与成本看板 | 本次会话 | 90 天 | 365 天 | 永久 + CSV 导出 |
| 按连接 / 模型聚合 | — | ✓ | ✓ | ✓ |
| API / Webhook / MCP 出口（用**你自己的 Key**） | — | — | ✓ | ✓ |
| 团队席位 | — | — | 1 个共享空间 | 5 席 |
| 支持 | 社区 | 邮件 | 优先邮件 | 优先 + 1v1 |

### 4.5 定价页必须写的一句话

> 订阅解锁的是 **客户端与工作流能力**（同步、检索、导出、编排、出口）。模型推理费用由你自己的 API Key 承担；Coolha 不代售任何模型算力。

---

## 五、链上收款方案（USDC / USDT）

### 5.1 网络与币种（首批）

| 网络 | 币种 | 说明 |
|---|---|---|
| **Base** | USDC（首选）、USDT | 手续费极低，Web3 用户主战场 |
| **Ethereum** | USDC、USDT | 流动性最好，适合大额/存量资金 |

后续按需加 Arbitrum / Polygon / Solana。

### 5.2 匹配方式：订单匹配法（推荐，无托管）

链上 ERC-20 转账**没有 memo 字段**，所以不能靠备注匹配。方案：

1. 用户在站内点「订阅 Pro」→ 服务端生成订单：`{ order_id, plan, amount_usd, amount_token, chain, expires_at(30min) }`
2. 页面展示收款地址 + 精确金额（含二维码 / 一键唤起钱包）
3. 用户从**计费地址**（与身份地址分离，见 ADR 决策三）转出该精确金额
4. 监听服务按 **(from, amount, 时间窗口)** 三元组匹配订单 —— 同一地址在同一窗口内转同一金额只可能有一笔，碰撞概率可忽略
5. 匹配成功 → `entitlements` 写入 plan + `period_end = now + 30d`，订单标记 paid

**优点**：零托管、零私钥管理、零用户填地址（从交易 `from` 读取）。

**另一条路：每用户充值地址（HD 派生 / CREATE2）** —— UX 更好（固定地址、可重复充值），但需要托管与归集，安全责任大。**暂不作为首批**。

### 5.3 资产门控（Token-gated）

作为**免支付**的补充路径：持有指定 ERC-20 / NFT 达到阈值 → 直接映射档位（例如持有 X ≥ N 即享 Ultra）。余额查询走 Alchemy（项目已配置 `ALCHEMY_KEY`）。零支付摩擦，天然契合 Web3，可作为社区激励。

### 5.4 监听与入账

- 主路径：**Alchemy Webhook**（Address Activity / Custom webhook 过滤 Transfer 到收款地址）
- 兜底：**Vercel Cron** 每 1–2 分钟轮询最近区块的 `Transfer` 日志（防 webhook 漏投）
- 入账**幂等**：以 `tx_hash + log_index` 唯一，重复回调不重复加期
- 只认 **确认数达标** 的转账（Base 建议 ≥ 3 确认，主网 ≥ 6）

### 5.5 状态机

```
none ──下单──> pending_payment ──链上到账──> active
                    │                          │
                过期/取消                   到期未续费
                    ↓                          ↓
                canceled                   past_due（3 天宽限）
                                                │
                                       宽限内续费 → active
                                       宽限结束  → expired → none
```

**无自动扣款**：EVM 无法主动拉取 ERC-20（除非用户授权 allowance + 我们代扣，风险与信任成本高，首批不做）。因此：
- 到期前 3 天站内提醒（+ 可选邮件，若用户绑定）
- 3 天宽限期内权益保留，`status = past_due`
- 宽限结束降级为 Free，**数据保留不删除**（保留 90 天）

### 5.6 退款

链上不可逆。**政策：不支持自动退款**；因我方故障导致的重复扣款/未授予权益，人工核对后原路退回用户指定地址。ToS 需明示。

### 5.7 合规红线

1. **链上支付不得成为绕过地理屏蔽的通道。** `proxy.ts` 已硬屏蔽的地区，即使完成付款，**授予权益时仍要二次校验** `x-coolha-geo-access-tier`，hit `hard-block` 则拒绝授予（否则违反上游 provider 的 supported-countries 条款）。
2. 我们收取的是**软件订阅费**，不是算力费、不是代币销售。定价页与 ToS 必须明示，避免被解读为证券/集资。
3. 稳定币收款在部分司法辖区属受监管活动；上线前按目标地区做评估，并在 ToS 写明辖区限制。
4. 若引入资产门控：持币解锁属"权益凭证"表述，避免使用"投资回报"类措辞。

---

## 六、数据结构（Phase 1 已建 / Phase 2 待建）

### 已建（005 迁移，本次实施）

```sql
-- 权益（档位的唯一判据）
entitlements(subject text PK,          -- 小写钱包地址（后续演进为 user_id::text）
             plan text DEFAULT 'free', -- free | plus | pro | ultra
             status text,              -- inactive | active | past_due | canceled | expired
             source text,              -- none | crypto | token_gate | manual
             period_end timestamptz,
             updated_at timestamptz)

-- 每日用量（token 计量的账本）
usage_daily(subject text, day date,    -- UTC 日
            requests int,
            input_tokens bigint,
            output_tokens bigint,
            PRIMARY KEY (subject, day))
```

### Phase 2 待建（计费工程，本次不做）

```sql
subscription_orders(id uuid PK, user_ref text, plan text,
                    chain text, token text,            -- 'USDC' | 'USDT'
                    amount_usd numeric, amount_token numeric,
                    pay_to text, status text,          -- pending | paid | expired | refunded
                    tx_hash text, log_index int, from_address text,
                    created_at timestamptz, expires_at timestamptz, paid_at timestamptz,
                    UNIQUE (tx_hash, log_index))

compute_ledger(id bigserial PK, user_ref text,
               kind text,                              -- subscription | refund | adjustment
               amount_usd numeric, balance_after numeric,
               ref_order_id uuid, created_at timestamptz)

billing_addresses(user_ref text, address text, label text, PRIMARY KEY (user_ref, address))
```

---

## 七、实施路线（更新）

| 阶段 | 内容 | 状态 |
|---|---|---|
| **P0** | 匿名禁用免费模型（401）+ 每日 token 配额（429）+ 删除裸露的 `/api/chat` | ✅ 已完成 |
| **P1** | `users` / `user_identities` 迁移，业务主键从地址演进为 `user_id`；会话接口带档位 | ✅ 已完成（迁移 006 + `src/lib/neon/identity.ts`） |
| **P2** | `subscription_orders` + Alchemy 扫描 + 订单匹配 + 权益授予（链上收款闭环） | ✅ 已完成（迁移 007 + `/api/subscription/*` + `/ai/billing`） |
| **P3** | 到期提醒 + 宽限降级（服务端判定 `past_due`）+ 资产门控 | 待办 |
| **P4** | 权益中间件（服务端统一 gate）、团队席位 | 待办 |

## 八、部署前必须配置

| 环境变量 | 用途 | 缺失时的行为 |
|---|---|---|
| `SUBSCRIPTION_TREASURY_ADDRESS` | 收款地址（建议专用地址，与身份地址无关） | 创建订单返回 `TREASURY_NOT_CONFIGURED`，扫描跳过 |
| `CRON_SECRET` | Vercel Cron 鉴权（Vercel 自动注入同名变量） | `/api/subscription/cron/sync` 返回 503 |
| `ALCHEMY_KEY` / `ALCHEMY_ID` | Base / Ethereum RPC（已有） | 扫链跳过，仅剩 webhook 通道 |
| `ALCHEMY_WEBHOOK_SIGNING_KEY` | Alchemy Webhook 签名校验 | webhook 端点返回 503（**默认关闭，不留开放入口**） |
| `FREE_MODELS_ENABLED` | 免费通道熔断开关（设 `0` 关闭） | 默认开启 |

### 入账的三条路径（互为冗余）

1. **用户主动确认**：`/api/subscription/orders/[id]/sync`（POST），回溯 ≈2.5 小时区块。
2. **轮询被动兜底**：`GET /api/subscription/orders/[id]`，订单 pending 且距上次扫链 >60s 时顺带扫一次 —— 即使 Cron 完全不可用，用户轮询也能自行完成入账。
3. **Vercel Cron**：`vercel.json` 每 5 分钟调 `/api/subscription/cron/sync`；仅在存在未过期 pending 订单时才扫链（省 RPC 配额）。
   ⚠️ Hobby 计划对 Cron 频率有限制，这也是路径 2 存在的原因。

### Alchemy Webhook（可选加速）

在 Alchemy Dashboard 创建 **Address Activity** webhook，监听收款地址的 ERC-20 转入，网络选 `ETH_MAINNET` 与 `BASE_MAINNET`，URL 填 `https://<域名>/api/subscription/webhook/alchemy`，把 Signing Key 写入 `ALCHEMY_WEBHOOK_SIGNING_KEY`。未配置时该端点直接 503，不影响其他两条路径。

## 九、待定（不阻塞）

- 各档 token 上限的实际合理性 —— 需上线后按 `usage_daily` 真实分布回归调整（先宽后紧）
- 年付折扣（如付 10 个月送 2 个月）
- Ultra 赠送的托管检索次数是否保留（成本项）
- 是否支持 ERC-20 授权代扣实现自动续费（信任与风险权衡）

## 十、部署就绪状态（2026-10-16 核对）

### 10.1 环境变量（Production，已写入 Vercel）

| 变量 | 类型 | 状态 |
|---|---|---|
| `SUBSCRIPTION_TREASURY_ADDRESS` | Config | ✅ `0x83e7…0182` |
| `FREE_MODELS_ENABLED` | Config | ✅ `1`（开启；设 `0` 即熔断） |
| `CRON_SECRET` | Secret | ✅ 已生成并写入（32 字符 base64url，应用自生成） |
| `ALCHEMY_WEBHOOK_SIGNING_KEY` | Secret | ✅ 已写入 |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Config | ✅ 已统一为 Neon `ep-broad-math-b361ynsa`，**可回读** |

`CRON_SECRET` 是应用自生成的随机串（Vercel Cron 会自动带 `Authorization: Bearer $CRON_SECRET`），不需要向任何第三方申请；它只用于保护 `/api/subscription/cron/sync`，轮换方式就是重新生成一个字符串覆盖写入，无其他依赖。

### 10.2 数据库迁移

迁移 001–007 已全部应用到生产库（Neon `ep-broad-math-b361ynsa`，PostgreSQL 18.6）。已核对 public schema 共 13 张表：

```
ai_gateway_usage, billing_addresses, compute_ledger, entitlements,
model_catalog, model_catalog_sync, subscription_orders, usage_daily,
user_identities, users, wallet_nonces, wallet_sessions, wallet_users
```

全部迁移均为幂等（`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / 回填带 `NOT EXISTS` 保护），可安全重复执行：

```bash
node scripts/apply-migration.mjs db/migrations/00X_xxx.sql
```

### 10.3 构建

生产构建通过（`rm -rf .next && npm run build`，EXIT=0）。生产模式冒烟：`/chat` 200、`/ai/billing` 200、`/api/health` 200，匿名 POST `/api/compute/playground` 返回 `401 AUTH_REQUIRED`。

### 10.4 两个必须记住的坑

1. **Vercel CLI 64 默认把变量存成 Secret（`--type secret`）**：Secret 值在 Dashboard 与 `vercel env pull` 中都是 `[SENSITIVE]`，**写进去就再也读不出来**，只能覆盖。数据库连接串这类“以后还要核对/重跑迁移”的值，务必用 `--type config`。
2. **不要用 `echo "值" | vercel env add` 传值**：PowerShell 管道会给 stdin 加 UTF-8 BOM（U+FEFF），值首字符变成 `65279`，连接串直接失效、密钥永远校验不过。必须用 `vercel env add NAME production --value "值"`（`cmd /c` 也被禁用，不要用）。

### 10.5 剩余步骤

- 提交并推送代码（当前有 74 项改动未提交，含 `package.json` 新增的 `server-only` 依赖 —— 漏提交会导致构建失败）。
- Vercel 首次部署后访问 `/api/health` 确认 `postgres.ok = true`。
- 在 Alchemy Dashboard 建 Address Activity webhook（可选，用于入账加速）。
