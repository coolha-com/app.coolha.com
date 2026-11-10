# Coolha app.coolha.com 项目长期记忆

## 基线
- Next **16.4.6**（2026-11-10 由 `next upgrade --agent=security` 从 16.4.0 升级；`next.config.ts` 已设 `experimental.agentUpgrade="security"`）/ React 19 / TS 5.9 / Tailwind 4 / shadcn(radix-luma, neutral, cssVariables)+base-ui / Reown AppKit+wagmi / next-intl。品牌主色 `#c0e218`。
- Neon Postgres（Vercel 集成 Coolha-Data, Free），接线 `src/lib/neon/`；迁移 `db/migrations/001`~`009`。
- **⚠️ 本地 `.env.local` 的 `DATABASE_URL` 指向生产库**，无独立生产环境 → 本地跑迁移=改生产库，先查再跑。`apply-migration.mjs` 靠 `IF NOT EXISTS` 幂等、无历史表、朴素解析器（值不带引号/不支持行内注释）。见 `docs/LOCAL_DEV.md`。
- `/api/v1/models` 字段短名 `zdr`/`no_training`（非 `zero_data_retention`）。
- `proxy.ts` 硬屏蔽 CN（`/api/` 返 451），本地 `__geoCountry` 覆盖。**链上支付不得绕过，授予权益时二次校验 geo header。**
- 质量门禁：`npm run lint` + `npx tsc --noEmit` + `npm run build`。**构建铁律**：safe-delete 拦截 `next build` 清 `.next` → 必须 `rm -rf .next && npm run build`；禁 `mv .next .next.old`。
- Git：coolha-com/app.coolha.com，常用分支 `agent`，Vercel Git 部署；`.env*.local` 均 gitignore。

## env / Vercel 铁律
- 四文件：`.env.local` 基线（**值一律不加引号**）+ `.env.development.local` / `.env.production.local` / `.env.preview.local`（后者 Next 不加载，仅对照）。新变量四文件一起改。基线必含 `AI_GATEWAY_API_KEY`/`REOWN_ID`/`ALCHEMY_KEY`/`ALCHEMY_ID`。
- **`vercel env pull` 把所有值写成带双引号且只改 `.env.local`** → ① 应用读到带引号串 → `28P01`；② 其余三文件仍是旧值，而 Next dev 优先 `.env.development.local`、build 优先 `.env.production.local` → 连旧库。必须剥引号 + 同步三文件；脚本层（`apply-migration.mjs`）同样要剥。
- CLI 默认存 Secret 不可回读，复核用 `--type config`；`env pull` 引号是格式非内容。
- **写入防 BOM**：禁 `echo | vercel env add`；统一 `vercel env add NAME <env> --force --type config --value "值"`，`preview` 加 `--yes`，多环境分开加；核验扫 `\uFEFF`。
- `vercel env rm` 同名多条目静默不删 → 走 REST `GET/DELETE /v9/projects/prj_2Zd9dENYklxBIQeAyKS6UMRUcLAH/env[/{envId}]`，token 在 `%APPDATA%\com.vercel.cli\Data\auth.json`；其 `expiresAt` 不可信，判过期只能实测 `GET /v2/user`。云端已去重 30 条/每变量一条三环境。
- AI Gateway key 不自动轮换、创建后不可取回、删除即失效、**成员离开自动停用其 key**（最常见故障）；生产可用 `VERCEL_OIDC_TOKEN`；泄露走 `POST vercel.com/external/compromised_secret`。

## 密钥入库铁律
**任何凭证值不得写进会入库文件**（含 `.workbuddy/memory/*.md`、`docs/`），记忆只写「见 `.env.local`」。推送前扫 commit 快照：`git grep -nE "vck_…|sk-…|gh[pousr]_…|0x{64}|eyJ…" <sha> -- .`（工作区 grep 不算）。被拦且未推送成功（`git branch -r --contains <sha>` 空）→ 从干净远端基线重提工作区，脏 commit 留本地，不 rebase/force push。例外：`scripts/siwe-smoke.mjs` Hardhat #0 公开私钥。

## 认证 / 商业模型
- 三套：Reown 钱包连接（纯客户端）；**SIWE 自建会话**（服务端主线）`/api/wallet-auth/*`+`wallet_users`(001)；Neon Managed Auth 邮箱（管理向）。冒烟：build 后 `next start -p 3100` + `node scripts/siwe-smoke.mjs`。
- 四档 USD/月 Free $0 / Plus $6 / Pro $10 / Ultra $30；**仅链上收 USDC/USDT（Base+Ethereum），不接 Stripe**。**三条资金流永不交叉**：订阅费→Coolha、付费模型费→上游(用户 Key)、赞助 token→Vercel。
- **只卖软件能力不卖算力**（保留期/同步/检索/导出/连接数/编排/API 出口）；定价页明示「推理费由你自己的 Key 承担」。额度与档位解耦：`SPONSORED_DAILY_TOKENS=300_000`、`SPONSORED_DAILY_REQUESTS=30`（UTC 日），全档相同。
- 身份四态 L0 匿名 / L1 连钱包 / L2 签名登录(得赞助额度) / L3 订阅；**连钱包≠登录**；主键 `subject=users.id::text`（降级 `wallet:0x…`）。赞助模型须签名登录（匿名 401），匿名仍可 BYOK（浏览器直连不计量）；熔断 `FREE_MODELS_ENABLED=0`。
- **营销黑名单**：「升级获得更多 tokens」「解锁更多模型」「更快响应」「用 Coolha 调用 GPT-5」。盈亏平衡≈5 个 Plus；P3（到期提醒/宽限降级）、P4（权益中间件/团队席位）不做。
- 合规红线是**「按 token 数分档」**而非「有免费模型」；终端用户走 Gateway 属 §8.3 Application（须独立 ToS/隐私政策/AI 披露 + 对 Vercel indemnity）。**AI SDK ≠ AI Gateway**：`createOpenAICompatible({baseURL})` 直连不经 ai-gateway.vercel.sh 则不适用。BYOK 浏览器直连合法；自部署网关只移除 Vercel 条款。演进：Vercel 买 Credits → 自部署 `openai/gpt-oss-20b`+vLLM 作默认赞助模型。

## 赞助模型 / 目录同步
- `isSponsorableModel = !isStealth && zeroDataRetention==="all" && noTraining==="all"` 且 input ≤ `SPONSORED_MAX_INPUT_PRICE_PER_MILLION=1`；当前 67 个，默认 `openai/gpt-oss-20b`。`/api/compute/playground` 门禁 403 `MODEL_NOT_SPONSORED`，带 `disallowPromptTraining:true`，`no_providers_available` 降级重试一次。
- 同步退避（`model_catalog_sync.failed_at`，迁移 009）：401/403 用 `CATALOG_AUTH_BACKOFF_SECONDS`，其他 `CATALOG_RETRY_BACKOFF_SECONDS`（均 300s）；`force=true`(`?refresh=1`) 跳过。`readCachedCatalogSnapshot` 走 unstable_cache（失败前快照、`failed_at` 空）→ 退避判定**必须**用不缓存的 `readCatalogSyncMeta()`。`digest==="DYNAMIC_SERVER_USAGE"` 是框架信号，须 `isNextControlFlowSignal()` 重抛（先 `releaseCatalogSync(false,{error:"RENDER_ABORTED"})`）；`isRealGatewayFailure()` 排除 `RENDER_ABORTED`/`SYNC_IN_PROGRESS`。错误串 `UPSTREAM_<status>:<提示>`。`/api/health` 读 `last_error/failed_at`，回源失败 `degraded=true`+503。回归 `node scripts/verify-catalog-backoff.mjs`。

## 存储 / 数据隔离 / 权益诚实
- **本地 IndexedDB 是唯一读源，云端仅可选镜像**：`src/lib/compute/local-db.ts`（零依赖 IDB）+`thread-store.ts`（`mode=local` 默认零服务端接触 / `mode=backup` 后台镜像）；旧 localStorage `coolha.conversations` 已迁移删除。IDB 坑：`IDBIndex.delete()` 不存在→`openCursor`+`cursor.delete()`；`put` 须在事务活动期内。
- 云端历史（008 `chat_threads`/`chat_messages`，`search_tsv`+GIN）走 `chat-history.ts`+`/api/chat/threads|history`；Free 严格 0 云端历史。**用户第三方 API Key 永不上行。**
- **面向终端用户查询必须带 subject 过滤**；跨用户聚合不得出现在用户页（运营视角单独命名+注释禁用）。过滤 null 主体用 `IS NOT DISTINCT FROM $1`。`authorizeHistory()` 是范式（401/403 分开）。示例数据用 `example/*`+「示例数据」+置灰徽章。回归 `node scripts/verify-usage-isolation.mjs`。
- 真生效强制点仅：playground 每日 token+次数配额、`authorizeHistory()` 云历史付费墙；BYOK 直连无法服务端强制。**定价页陈列即承诺**：`pricing-matrix.ts` 的 `PENDING_ROWS` 6 行（`byokConnections`/`personas`/`promptTemplates`/`parallelCompare`/`routingPolicies`/`apiAccess`）UI 显灰「规划中」；**新增 `PlanLimits` 字段须同步 `PENDING_ROWS`**，已实现能力不得误挂 `ROADMAP`。
- 订阅页：定价表对所有人可见（`PricingTable.tsx`），付费 CTA 未登录变「请先连接钱包/签名登录」，登录后显档位/订单/账本。模型广场：只做目录+价格，**不转售 Key**；赞助→`/chat?model=<slug>`，其余→`/ai/api-keys`；`CostEstimator` 标题「费用参考」。

## 信息架构（2026-11-10 重构，先看这里）
- **主导航 5 项**：智能对话 `/chat`（第一）→ 智能服务 `/agents` → 数据和接口 `/data` → 账户和支付 `/billing` → 开发者控制台 `/console`。「服务发现」(`/`) 与「接入指南」(`/connect`) 导航已删；`/` 307→`/chat`；i18n 三语同步（agents→智能服务/AI Services、data→数据和接口/Data & Interfaces）。
- **`/ai` 聚合模块已解散**，页面真搬到主导航子路由，站内 20+ 处链接同步更新：`/ai/tools`→`/data/tools`、`/ai/research`→`/agents/research`（作为 Agent 服务）、`/ai/models`+`[id]`→`/console/models`、`/ai/api-keys`→`/console/api-keys`、`/ai/billing`→`/billing/subscription`、`/ai/usage`→`/billing/usage`、`/ai/agents/rwa-research`→`/agents/rwa-research`。
- 旧 `/ai/*`、`/connect`、`/developers` 由 `next.config.ts` 的 `redirects()` 做 307 兜底（全部实测通过）；**`/api/ai/tools/[slug]` 服务端执行点保持不动**（批量替换时特意用占位符保护 `/api/ai/tools` 前缀）。
- `/connect` 与 `/developers` 内容已合并进 `/console`（接入说明 + API/MCP 区块），两页文件已删除。`tsconfig.json` 的 `exclude` 已加 `app.coolha.com`，消除嵌套旧副本带来的 4 个既有类型错误；`lint`/`tsc`/全路由 curl 均通过。
- ⚠️ 下文「/ai 模块」等章节里的 `/ai/*` 均为**旧路径**，仅作历史背景；实际代码位置以上表为准。`docs/` 里的旧路径引用未改，靠 redirects 兜底。

## /ai 模块（算力市场，旧路径 / 历史背景）
- 子导航 `ComputeSubNav`（已删 Chat）：`/ai/tools` → `/ai/research` → `/ai/models` → `/ai/api-keys` → `/ai/usage` → `/ai/billing`；`ModulePage` 壳层；**`/ai` 重定向到 `/ai/tools`**，Chat 入口只在侧边栏第一项。
- **/ai/tools**：只接以太坊官方 agent-tooling 目录现成 MCP/Skill/CLI，不自研。31 条中 1 条 `integration:"live"`（`alchemy-mcp-server`），其余 30 条 `"none"`（显「未接入」）。执行点 `/api/ai/tools/[slug]`（服务端 Alchemy JSON-RPC 只读：区块高度/时间、原生币余额、nonce；Base+Ethereum），前端 `ToolLiveRunner.tsx`（点击才请求 → 页面仍 `force-static`）。接的是 Alchemy 链上数据能力，**不是官方 mcp.alchemy.com MCP 端点**。P0 下一步 DefiLlama/Slither + 签名流。红线圈：`"none"` 不得暗示可用；`"live"` 必须在 `docs/ENTITLEMENT_ENFORCEMENT_STATUS.md` §14 有执行点；服务端不托管第三方密钥/不代售 key；写操作先出交易草稿再签名；未配置/上游失败如实报「未接入」，**绝不返回占位数值**。
  - **陈列即承诺**：`live` 条目 `name` 是官方原名，与实际接入能力不总一致 → 卡片正文（不折叠）必须写清接入范围：`catalog.ts` 的 `liveScope` + `ToolCard` 渲染；「支持 100+ 链」说的是该工具本身 → 文案改「该工具支持：」。
- **Alchemy 统一到 `src/lib/alchemy/client.ts`（`server-only`）**：凭证 `ALCHEMY_KEY` 优先/`ALCHEMY_ID` 兜底/空串跳过；错误分类 `NOT_CONFIGURED`/`UPSTREAM_TIMEOUT`/`UPSTREAM_RATE_LIMIT`/`UPSTREAM_AUTH`/`UPSTREAM_ERROR`/`INVALID_RESPONSE`；抛错前统一脱敏（key→`[redacted]`）。投前侦察吞异常返回 null（要 unavailable 语义），工具层拿 `AlchemyError` 分类。
- **证据信封 `src/lib/web3-tools/evidence.ts`**（契约 `docs/WEB3_TOOL_REGISTRY_PHASE1_PLAN.md` §4）：`ToolResult<T>` = `ok`/`tool`/`source{provider,method,endpoint,chain,chainId,fetchedAt,latencyMs}`/`data`/`warnings`/`unknown`/`coverage`/`error`；`trace()` 统一计时+异常捕获，保证 `ok=false` 时 `data` 必 null、`unknown` 必非空。反幻觉四规则：`ok`+`data`=先取数再断言、`source`=可溯源、`unknown[]`=没查到就说没查到、`coverage`+`warnings[]`=声明覆盖边界。⛔ 工具层**不生成任何评分/概率/评级**（曾因假风险分出事故）。
- **/ai/research（真实数据，无模拟）**：五维度，`src/lib/research/{types,dimensions,sources,engine}.ts`+`POST /api/research`（nodejs）。合约=Sourcify+Alchemy `eth_getCode`；链上=Alchemy 余额/nonce；代币=DefiLlama 价格/TVL；**Alchemy key 只在服务端**。`team`/`sentiment` 无免费源 → `status:"unavailable"`，不给数值与判断；**已移除 0-100 风险分**，改定性结论+`basis`。UI `ResearchCockpit.tsx`。坑：DefiLlama `/protocol/{slug}` 的 `tvl` 是历史数组，须 `series.at(-1).totalLiquidityUSD`。

## 部署 / 发版 / 文档
- 生产 env 已配齐（`SUBSCRIPTION_TREASURY_ADDRESS`/`CRON_SECRET`/`ALCHEMY_WEBHOOK_SIGNING_KEY`/`FREE_MODELS_ENABLED=1`），三环境一致；构建通过，冒烟 `/chat`200 `/ai/billing`200 `/api/health`200、匿名 POST 401。用户侧待办：买 Gateway Credits、设 Budgets、轮换 `AI_GATEWAY_API_KEY`、补 §8.3 ToS/隐私政策/AI 披露。
- **release-please 已整体移除**（workflow + config + manifest + 空 `.github/`）→ 仓库无 CI。版本真相源 `package.json` 的 `version`(`0.1.2-alpha`)，CHANGELOG 手动维护，本就无 CHANGELOG.md。恢复须三件成组 + `RELEASE_PLEASE_TOKEN`/Actions 建 PR 权限。
- 清理散文件先全仓核查引用（`src`/`docs`/`scripts`/根配置）再删，删除保持未暂存由用户决定提交。
- **文档在根 `docs/`**（16 份，入口 `docs/PROJECT_OVERVIEW.md`）；`.workbuddy/docs/` 已空，引用一律用 `docs/`。**`.workbuddy/memory/` 未被 gitignore（会入库 → 严禁写密钥）**；`.workbuddy/c-…/` 会话副本与 `conversation-export.md` 已 gitignore。
