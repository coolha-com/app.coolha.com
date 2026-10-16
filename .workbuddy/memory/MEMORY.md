# Coolha app.coolha.com 项目长期记忆

## 事实基线

- 技术栈：Next 16.4.0 / React 19.3.0 / TS 5.9.3 / Tailwind 4.3.3 / shadcn + base-ui / Reown AppKit 1.8.24 + wagmi 3.7.7 / next-intl 4.14.9。品牌主色 `#c0e218`。
- 数据库：Neon Postgres（Vercel 集成，产品 Coolha-Data，Free 计划），接线在 `src/lib/neon/`；迁移 `db/migrations/001`~`008`。
- `proxy.ts` 硬屏蔽 CN 等（`/api/` 返回 451）；本地开发用 `__geoCountry` 覆盖。**链上支付不得绕过该屏蔽，授予权益时二次校验 geo header。**
- 质量门禁：`npm run lint` + `npx tsc --noEmit` + `npm run build`（无 typecheck/test 脚本）。
- **构建铁律**：本环境 safe-delete 会拦截 `next build` 内部清理 `.next`（`SAFE_DELETE_BULK_GUARD_ERROR`）→ 必须 `rm -rf .next && npm run build`；禁止 `mv .next .next.old` 遗留大目录，build 后确认无 `.next.old-*` 残留。
- Git：仓库 coolha-com/app.coolha.com，常用分支 `agent`；部署走 Vercel Git 集成。`.env*.local` 均 gitignore。

## 环境 / Vercel env 铁律

- 本地四文件：`.env.local`=基线（**值一律不加引号**，`scripts/apply-migration.mjs` 用朴素解析器）、`.env.development.local`=Dev 镜像、`.env.production.local`=Prod 镜像、`.env.preview.local`（Next 不加载，仅对照）。
- ① CLI 默认存 **Secret → 写入后不可回读**（Dashboard/`env pull` 显示 `[SENSITIVE]`）；需复核的值必须 `--type config`。
- ② 禁止 `echo 值 | vercel env add`（PowerShell 管道加 UTF-8 BOM）→ 统一 `vercel env add NAME <env> --force --type config --value "值"`，值内不带引号。
- ③ `vercel env add NAME preview` 必须加 `--yes`（否则静默失败）；多环境须分开加；`--force` 可直接覆盖。
- ④ `vercel env rm` 同名多条目时静默不删 → 走 REST `GET/DELETE /v9/projects/prj_2Zd9dENYklxBIQeAyKS6UMRUcLAH/env[/{envId}]`，token 读 `%APPDATA%\com.vercel.cli\Data\auth.json`。
- 云端已去重整合为 **30 条 / 每变量仅一条三环境条目**。Neon Managed Auth schema 列名为 camelCase。
- ⚠️ **`.env.local`（Next 全模式加载的基线）必须含 `AI_GATEWAY_API_KEY`**：2026-10-16 发现它当时缺这把 key，只存在于三个 `.env.*.local` 镜像里 —— 结构上极易漏改。基线里另需 `REOWN_ID/ALCHEMY_KEY/ALCHEMY_ID`。
- ⚠️ **Vercel CLI 凭据会过期**：`%APPDATA%\com.vercel.cli\Data\auth.json` 的 `token` 有 `expiresAt`，过期后 CLI 与 REST 都 401，须先 `vercel login`（当时 expiresAt 显示 1970-01-21）。
- **Vercel AI Gateway key 机制（官方核实）**：key **不会自动轮换**（官方原文 never expire unless revoked）；Dashboard 里 `AI Gateway Playground Key` 是 Vercel 自建的独立系统 key，与用户自建 key 并存，**不是同一把在变**；**key 创建后无法取回**，丢了只能新建；删 key 立即失效；**团队成员离开会自动停用其创建的 key**（key 突然失效的最常见原因）；新 key 默认归属个人（个人+团队预算任一超限即拒），要只计团队需 `metadata.spendAttribution=team`（仅 Owner/Budget Manager）；生产可用 `VERCEL_OIDC_TOKEN` 免长期 key；泄露可 `POST vercel.com/external/compromised_secret` 无认证撤销。

## 认证

三套并存：① Reown 钱包连接（纯客户端）；② **SIWE 自建钱包会话**（服务端鉴权主线）`/api/wallet-auth/*` + `wallet_users/nonces/sessions`（001）；③ Neon Managed Auth 邮箱 `/api/auth/*`（管理向）。
SIWE 冒烟：build 后 `next start -p 3100` + `node scripts/siwe-smoke.mjs`（Hardhat #0）。

## 商业模型（A 路线，2026-10-16 定稿，见 docs/ROUTE_A_BUSINESS_MODEL.md）

- 四档 USD/月：Free $0 / Plus $6 / Pro $10 / Ultra $30。**仅链上收款 USDC/USDT（Base+Ethereum），不接 Stripe。**
- **三条资金流永不交叉**：订阅费→Coolha（买软件）；付费模型费→上游（用户自己的 Key）；赞助 token→Vercel（市场预算）。
- **付费只卖软件能力**（历史保留期/同步/检索/导出/连接数/编排/API 出口），**不卖算力**。定价页必须明示"推理费用由你自己的 Key 承担"。
- **额度与档位彻底解耦**：全局常量 `SPONSORED_DAILY_TOKENS=300_000`、`SPONSORED_DAILY_REQUESTS=30`（UTC 自然日），所有档位相同。`plans.ts` 已删 `PlanQuota`/`quota`/`queuePriority`/`concurrentSessions`/`teamSeats`。
- 身份四态：L0 匿名 / L1 连钱包（纯前端）/ L2 签名登录（得赞助额度）/ L3 订阅。**连接钱包 ≠ 登录**。内部唯一 ID 用 `user_id`，EVM 地址只是锚点。业务主键 `subject` = `users.id::text`（降级 `wallet:0x...`）。
- 免费赞助模型必须签名登录（匿名 401）；匿名仍可 BYOK（浏览器直连，不计量不限流）。熔断 env `FREE_MODELS_ENABLED=0`。
- 收款匹配：订单匹配法（from+amount+时间窗），无托管；Alchemy Webhook 主 + Vercel Cron 兜底；幂等 `tx_hash+log_index`；手动续费 + 3 天宽限。
- **营销文案黑名单**：「升级获得更多 tokens」「解锁更多模型」「更快响应」「用 Coolha 调用 GPT-5」。SubscriptionPanel 严禁写 token 类卖点。
- 盈亏平衡 ≈ 5 个 Plus。P3（到期提醒/宽限降级）与 P4（权益中间件、团队席位）已决定不做。

## 合规红线（Vercel，2026-10-16 精确定位）

- AUP 禁 "sell access / make Services available to third party"、禁转让第三方 provider API key；AI Product Terms §2 仅限 **personal or internal business use**；§8.2 Stealth 模型无数据保护。
- **真正红线是「按 token 数分档」**，不是「有免费模型」。App 内终端用户走 Gateway 属 §8.3 Application 场景（合法，须备独立 ToS+隐私政策、提前披露 AI、对 Vercel 负 indemnity）；赞助模型 genuinely 免费合法；BYOK 浏览器直连合法；**订阅解锁付费模型 = 转售 token（违规）**。
- 官方给 router 开绿灯（KB《build your own AI model router》/models 可重新暴露）。界限：**卖 token = 违规；卖产品/能力 = 允许**。
- **AI SDK ≠ AI Gateway**：`createOpenAICompatible({ baseURL })` 可直连任意 OpenAI 兼容端点，不经 ai-gateway.vercel.sh 则不適用上述条款。
- Gateway 计划：无付费会员 = 仅 $5/月额度 + 仅 Free Tier eligible 子集 + **BYOK 不可用**；买 Credits 转付费层（全目录 zero markup，$5 免费额度失效）；团队级 ZDR/allowlist 需 Pro+。`disallowPromptTraining` 全计划免费（BYOK 不适用，无合规 provider 时报 `400 no_providers_available`）。
- 差价模式不成立（zero markup 无批发价；上游均禁 resell/转让 key）。合法差价仅：协议价、batch 50%、cache 10%、模型降级。
- 自建/开源网关备选：LiteLLM（MIT，⚠️2026-03 PyPI 投毒须锁 commit）、Bifrost（Apache-2.0，Go 开销最低）、Portkey（被 Palo Alto 收购）、Envoy AI Gateway、Kong AI、Helicone（GPL-3.0）、OpenRouter（闭源抽 5.5%）、LLMGateway.io（AGPLv3）。**自建只移除 Vercel 条款，不移除上游条款。**
- 推荐演进：A 留 Vercel 买 Credits → C 自部署 `openai/gpt-oss-20b`（Apache 2.0）+ vLLM 单 GPU 作默认赞助模型（数据不出机器，Web3 最强卖点），高峰 fallback 上游 ZDR 模型。

## 赞助模型判定（数据政策，非价格）

`isSponsorableModel = !isStealth && zeroDataRetention==="all" && noTraining==="all"` 且 input price ≤ `SPONSORED_MAX_INPUT_PRICE_PER_MILLION=1`。
4 个真正 $0 的语言模型（nemotron-3.5-lightning-free / stealth-cat-jam / stealth-glyph-cluster / poolside-laguna-s-2.1-free）**全是 zdr=none+noTraining=none（拿数据训练）**，不可赞助。反向：315 个 language 中 138 个 ZDR=all+noTraining=all，最便宜 $0.029/M；当前赞助集合 67 个，默认 `openai/gpt-oss-20b`。
`/api/compute/playground` 用 `isSponsorableModel` 门禁 → 403 `MODEL_NOT_SPONSORED`；请求带 `disallowPromptTraining: true`（`AI_GATEWAY_DISALLOW_TRAINING=0` 可关）；遇 `no_providers_available` 降级重试一次。

### 目录同步的失败处理（三条易踩的规则，2026-10-16）

- **失败必须有退避**：`model_catalog_sync` 加 `failed_at`（迁移 009），失败写入、成功清空；`client.ts` 认领锁前判窗口（401/403 用 `CATALOG_AUTH_BACKOFF_SECONDS`，其他用 `CATALOG_RETRY_BACKOFF_SECONDS`，均 300s），窗口内复用陈旧快照。**force=true（`/api/v1/models?refresh=1`）跳过退避**，key 轮换后立即生效。没有退避时 `synced_at` 不推进 → 快照永不新鲜 → 每次渲染都重打上游并刷一条 error。
- **退避判定绝不能读 Data Cache**：`readCachedCatalogSnapshot` 走 `unstable_cache`（TTL 3600s），里面是**失败发生前**的快照，`failed_at` 为空 → 判定永不成立。必须用 `readCatalogSyncMeta()`（不走缓存，只读那一行）。
- **Next.js 控制流信号不能吞**：`digest === "DYNAMIC_SERVER_USAGE"` 是框架中断静态预渲染的内部信号。被 catch 吞掉会让 `last_error` 变成无关的构建错误、**掩盖真正的 401**，且 `failed_at` 置位触发错误退避。用 `isNextControlFlowSignal()` 重抛（先 `releaseCatalogSync(false,{error:"RENDER_ABORTED"})` 释放锁，否则锁被按住 120s）；`isRealGatewayFailure()` 排除 `RENDER_ABORTED`/`SYNC_IN_PROGRESS`。
- 错误串格式 `UPSTREAM_<status>:<上游提示>`（Vercel 401 正文带生成 key 的链接，只留状态码运维无法行动）。`/api/health` 已改为读 `last_error/failed_at`，回源失败时 `degraded=true` + HTTP 503。回归验证跑 `node scripts/verify-catalog-backoff.mjs`（18 项断言）。

## 本地优先存储（2026-10-16 已实现，隐私叙事核心）

- **本地 IndexedDB 是唯一读源，云端只是可选镜像**。`src/lib/compute/local-db.ts`（零依赖 IDB，threads/messages/meta）+ `thread-store.ts`（统一 store：`mode=local` 默认零服务端接触 / `mode=backup` 后台镜像）。旧 localStorage `coolha.conversations` 自动迁移；`conversations.ts` 已删。
- `/settings` 提供模式切换、立即备份、从云端恢复（**合并不覆盖**）、本机与云端分别独立清空、隐私说明。
- **IDB 坑**：`IDBIndex.delete()` 不存在 → 用 `openCursor` + `cursor.delete()`；`put` 必须放在事务活动期内（`oncomplete` 时事务已结束 → TransactionInactiveError）。
- 云端历史（008 `chat_threads`/`chat_messages`，`search_tsv` 生成列 + GIN）走 `src/lib/neon/chat-history.ts` + `/api/chat/threads|history`；Free 严格 0 云端历史（云历史是纯付费墙）。**用户的第三方 API Key 永不上行服务端。**

## 权益强制现状

唯一真正生效的档位强制点是 playground 的每日 token + 次数配额，以及 `chat-history.ts` 的 `authorizeHistory()`（云历史付费墙）；`PlanLimits` 其余字段多为纸面配置（见 `docs/ENTITLEMENT_ENFORCEMENT_STATUS.md`）。BYOK 浏览器直连 ⇒ 围绕 BYOK 的权益（连接数/路由/成本看板）无法服务端强制，可强制的只有服务端持有数据的能力。

**定价页陈列的是承诺，纸面配置出现在承诺表里就是卖空气。** `pricing-matrix.ts` 的 `PENDING_ROWS` 列出无执行点的 6 行（`byokConnections`/`personas`/`promptTemplates`/`parallelCompare`/`routingPolicies`/`apiAccess`），UI 统一显示灰色「规划中」而非 ✓/数字；卡片卖点只列已落地项。**新增 `PlanLimits` 字段时必须同步 `PENDING_ROWS`，否则就是新增一条空头承诺。** 反向纪律同样成立：已实现并强制的能力不得继续挂在 `ROADMAP`（2026-10-16 曾把云历史/全文检索误列为规划中，实际 008 迁移已生效）。`tagline` 同理不得出现已删除的 `queuePriority` 之类概念。

## 订阅页（2026-10-16 定稿交互）

**定价表对所有人可见，无需登录**（`PricingTable.tsx` 独立于 `SubscriptionPanel.tsx`）。四档卡片 + 13 行权益对照矩阵；付费 CTA 未登录时变「请先连接钱包 / 签名登录以订阅」。登录后才出现：当前档位卡、支付网络币种、待支付订单、账本流水、未登录引导卡。价格与权益是公开信息，藏起来只会让人以为要注册才知道多少钱；登录的必要性只体现在订单归属。

## 环境模板

`.env.local.example` 是唯一公开模板（`.gitignore` 为它开了白名单）。含全部 23 个变量 + 用途注释 + 三个易踩提醒：key 创建后不可取回、**值一律不加引号**（`apply-migration.mjs` 是朴素解析器）、**`.env.local` 是基线最易漏改**（新变量要四个文件一起改）。

## 数据隔离铁律（2026-10-16 隐私缺陷后确立）

- **任何面向终端用户的查询必须带 subject 过滤**。「多用户共用表 + 读取时不过滤」会把所有人的钱包地址、模型选择、调用时间、失败原因公开给任意访客——`/ai/usage` 就是这么泄露的（15 条记录 / 2 个钱包被任意访客看到）。
- **过滤 null 主体用 `IS NOT DISTINCT FROM $1`，不是 `= $1`**：未登录时 subject 为 null，`= NULL` 恒不成立（SQL 常见陷阱）。`chat-history.ts` 的 `authorizeHistory()` 是正确范式：401 未登录 / 403 无权益**分开报**。
- **跨用户聚合数据不得出现在面向用户的页面**。运营视角单独命名（`summarizeUsageAllUsers()`）并在注释写明禁止用于终端页面，只允许数据库直查与运维脚本。
- 空态与示例数据纪律：示例行的模型名/ID 用 `example/*`，并显式标注「示例数据」，徽章置灰——避免被误认为真实数据（项目原有纪律，本次一并修掉 usage 页的违规）。
- 回归验证：`node scripts/verify-usage-isolation.mjs`（8 项断言）。

## 模型广场 / 详情页

只做目录与价格查询，**不提供 API/Key 转售**。详情页分叉：赞助模型 →「在 Chat 中对话」`/chat?model=<slug>`（登录+配额）；其余 →「配置自定义模型」`/ai/api-keys`（BYOK）。徽标「零数据保留 · 不训练」/「不在赞助范围」。`CostEstimator` 标题「费用参考」，明示是**你自己的 Key** 的费用。

## /chat 模型选择器（2026-10-16 定稿交互）

交互优先、文字解释不占界面：删掉「模型怎么选」文本块；单一滚动容器（禁止双滚动）；分组标签承载一次性信息（「赞助模型 · 免费 · 零数据保留 · 不用于训练」「我的连接 · 你自己的 Key · 无需登录 · 不限量」）；每行只留一个「免费」chip + 悬浮/聚焦才出现的行内详情箭头（`opacity-0 group-hover:opacity-100`，`stopPropagation`）；完整信息放 `title` tooltip；底部操作 `sticky bottom-0`。

## 部署就绪状态（2026-10-16）

生产 env 已配齐（`SUBSCRIPTION_TREASURY_ADDRESS=0x83e7…0182`、`CRON_SECRET`、`ALCHEMY_WEBHOOK_SIGNING_KEY`、`FREE_MODELS_ENABLED=1`）；三环境变量集一致（Preview +22、Development +4 已补齐；`CIRCLE_KIT_KEY` 代码零引用已删）。生产构建通过；冒烟 `/chat`200 `/ai/billing`200 `/api/health`200、匿名 POST 401。
**待用户提交推送**（含 `server-only` 依赖，必带）。用户侧待办：购买 Gateway Credits、设 Budgets、轮换 AI_GATEWAY_API_KEY、补齐 §8.3 独立 ToS/隐私政策与 AI 披露。
