# Coolha app.coolha.com 项目长期记忆

## 事实基线
- 技术栈：Next 16 / React 19 / TS 5.9 / Tailwind 4 / shadcn+base-ui / Reown AppKit + wagmi / next-intl。品牌主色 `#c0e218`。
- 数据库：Neon Postgres（Vercel 集成，产品 Coolha-Data，Free 计划），接线 `src/lib/neon/`；迁移 `db/migrations/001`~`009`。
- **⚠️ 本地 `.env.local` 的 `DATABASE_URL` 指向生产库**（同一 Neon 实例，ap-southeast-1）。无独立生产环境，**本地跑迁移=直接改生产库**，先查再跑。`apply-migration.mjs` 无历史表、靠 `IF NOT EXISTS` 幂等；朴素解析器（值不带引号、不支持行内注释）。说明见 `docs/LOCAL_DEV.md`。
- `/api/v1/models` 目录字段是短名 `zdr`/`no_training`，非 `zero_data_retention`。
- `proxy.ts` 硬屏蔽 CN 等（`/api/` 返 451）；本地用 `__geoCountry` 覆盖。**链上支付不得绕过，授予权益时二次校验 geo header。**
- 质量门禁：`npm run lint` + `npx tsc --noEmit` + `npm run build`。**构建铁律**：safe-delete 拦截 `next build` 清 `.next` → 必须 `rm -rf .next && npm run build`；禁 `mv .next .next.old`。
- Git：仓库 coolha-com/app.coolha.com，常用分支 `agent`；Vercel Git 部署。`.env*.local` 均 gitignore。

## 环境 / Vercel env 铁律
- 本地四文件：`.env.local`=基线（**值一律不加引号**）、`.env.development.local`、`.env.production.local`、`.env.preview.local`（Next 不加载，仅对照）。新变量四文件一起改。
- CLI 默认存 **Secret → 不可回读**；需复核值用 `--type config`。`env pull` 输出统一带引号（格式非内容）。
- **密钥值写入防 BOM**：禁 `echo | vercel env add`（PS 管道加 UTF-8 BOM）；统一 `vercel env add NAME <env> --force --type config --value "值"`。`preview` 须加 `--yes`，多环境分开加。核验扫 `env pull` 值是否含 `\uFEFF`。
- `vercel env rm` 同名多条目静默不删 → 走 REST `GET/DELETE /v9/projects/prj_2Zd9dENYklxBIQeAyKS6UMRUcLAH/env[/{envId}]`，token 读 `%APPDATA%\com.vercel.cli\Data\auth.json`。
- **`.env.local` 基线必须含 `AI_GATEWAY_API_KEY`**（曾漏配）；另需 `REOWN_ID/ALCHEMY_KEY/ALCHEMY_ID`。云端已去重为 30 条/每变量一条三环境。
- **Vercel CLI 凭据**：`auth.json` 的 `expiresAt` **不可信**（显 1970 但实测有效，user=coolha-limited）；判过期只能实测 `GET /v2/user`。
- **AI Gateway key 不会自动轮换**；创建后无法取回，丢失只能新建；删则立即失效；**团队成员离开自动停用其创建的 key**（key 失效最常见原因）；生产可用 `VERCEL_OIDC_TOKEN` 免长期 key；泄露 `POST vercel.com/external/compromised_secret` 撤销。

## 密钥入库铁律（GH013 事故后）
**任何凭证值都不得写进会入库文件**（含 `.workbuddy/memory/*.md`、`docs/`）。记忆只写「见 `.env.local`」。
- 推送前扫 commit 快照（工作区 grep 不算）：`git grep -nE "vck_…|sk-…|gh[pousr]_…|0x{64}|eyJ…" <sha> -- .`
- 被拦且未推送成功（`git branch -r --contains <sha>` 为空）：从干净远端基线重提工作区，脏 commit 留本地即可，不 rebase/force push。
- 例外：`scripts/siwe-smoke.mjs` Hardhat #0 公开私钥（文件头注明无资产）。

## 认证
三套：① Reown 钱包连接（纯客户端）；② **SIWE 自建钱包会话**（服务端鉴权主线）`/api/wallet-auth/*`+`wallet_users`（001）；③ Neon Managed Auth 邮箱 `/api/auth/*`（管理向）。SIWE 冒烟：build 后 `next start -p 3100` + `node scripts/siwe-smoke.mjs`。

## 商业模型（A 路线）
- 四档 USD/月：Free $0 / Plus $6 / Pro $10 / Ultra $30。**仅链上收款 USDC/USDT（Base+Ethereum），不接 Stripe。**
- **三条资金流永不交叉**：订阅费→Coolha；付费模型费→上游（用户 Key）；赞助 token→Vercel。
- **付费只卖软件能力**（保留期/同步/检索/导出/连接数/编排/API 出口），**不卖算力**。定价页明示「推理费由你自己的 Key 承担」。
- **额度与档位解耦**：`SPONSORED_DAILY_TOKENS=300_000`、`SPONSORED_DAILY_REQUESTS=30`（UTC 日），所有档位相同。
- 身份四态：L0 匿名 / L1 连钱包 / L2 签名登录（得赞助额度）/ L3 订阅。**连接钱包≠登录**；主键 `subject=users.id::text`（降级 `wallet:0x…`）。
- 免费赞助模型须签名登录（匿名 401）；匿名仍可 BYOK（浏览器直连，不计量）。熔断 `FREE_MODELS_ENABLED=0`。
- **营销黑名单**：「升级获得更多 tokens」「解锁更多模型」「更快响应」「用 Coolha 调用 GPT-5」。盈亏平衡≈5 个 Plus；P3（到期提醒/宽限降级）与 P4（权益中间件/团队席位）不做。

## 合规红线（Vercel）
- **真正红线是「按 token 数分档」**，不是「有免费模型」。卖 token=违规；卖产品/能力=允许。终端用户走 Gateway 属 §8.3 Application（合法，须独立 ToS+隐私政策+AI 披露+对 Vercel indemnity）。
- **AI SDK ≠ AI Gateway**：`createOpenAICompatible({baseURL})` 直连任意 OpenAI 兼容端点不经 ai-gateway.vercel.sh 则不适用上述条款。
- BYOK 浏览器直连合法；自建/开源网关（LiteLLM/Bifrost 等）只移除 Vercel 条款，不移除上游条款。推荐演进：留 Vercel 买 Credits → 自部署 `openai/gpt-oss-20b`+vLLM 作默认赞助模型。

## 赞助模型判定 + 目录同步
- `isSponsorableModel = !isStealth && zeroDataRetention==="all" && noTraining==="all"` 且 input price ≤ `SPONSORED_MAX_INPUT_PRICE_PER_MILLION=1`。当前赞助集合 67 个，默认 `openai/gpt-oss-20b`。`/api/compute/playground` 门禁→403 `MODEL_NOT_SPONSORED`；带 `disallowPromptTraining:true`；遇 `no_providers_available` 降级重试一次。
- 同步退避（`model_catalog_sync.failed_at`，迁移 009）：401/403 用 `CATALOG_AUTH_BACKOFF_SECONDS`，其他 `CATALOG_RETRY_BACKOFF_SECONDS`（均 300s）；`force=true`（`?refresh=1`）跳过。`readCachedCatalogSnapshot` 走 unstable_cache（失败前快照，`failed_at` 空）→ 退避判定**必须**用 `readCatalogSyncMeta()`（不缓存）。`digest==="DYNAMIC_SERVER_USAGE"` 是框架信号，用 `isNextControlFlowSignal()` 重抛（先 `releaseCatalogSync(false,{error:"RENDER_ABORTED"})`），`isRealGatewayFailure()` 排除 `RENDER_ABORTED`/`SYNC_IN_PROGRESS`。错误串 `UPSTREAM_<status>:<提示>`。`/api/health` 读 `last_error/failed_at`，回源失败 `degraded=true`+503。回归 `node scripts/verify-catalog-backoff.mjs`。

## 本地优先存储（隐私叙事核心）
- **本地 IndexedDB 是唯一读源，云端仅可选镜像**。`src/lib/compute/local-db.ts`（零依赖 IDB）+ `thread-store.ts`（`mode=local` 默认零服务端接触 / `mode=backup` 后台镜像）。旧 localStorage `coolha.conversations` 已迁移删除。
- IDB 坑：`IDBIndex.delete()` 不存在→`openCursor`+`cursor.delete()`；`put` 须在事务活动期内。
- 云端历史（008 `chat_threads`/`chat_messages`，`search_tsv`+GIN）走 `chat-history.ts`+`/api/chat/threads|history`；Free 严格 0 云端历史。**用户第三方 API Key 永不上行。**

## 数据隔离铁律（隐私缺陷后）
- 任何面向终端用户查询**必须带 subject 过滤**。跨用户聚合数据**不得**出现在面向用户页面（运营视角单独命名+注释禁止用于终端页）。
- 过滤 null 主体用 `IS NOT DISTINCT FROM $1`（非 `= $1`）。`authorizeHistory()` 是范式：401/403 分开报。
- 示例数据用 `example/*`+显式「示例数据」+徽章置灰。回归 `node scripts/verify-usage-isolation.mjs`。

## 权益 / 定价页诚实纪律
- 真生效的强制点仅：playground 每日 token+次数配额、`authorizeHistory()` 云历史付费墙。BYOK 直连→相关权益无法服务端强制。
- **定价页陈列即承诺**：`pricing-matrix.ts` 的 `PENDING_ROWS` 列无执行点的 6 行（`byokConnections`/`personas`/`promptTemplates`/`parallelCompare`/`routingPolicies`/`apiAccess`），UI 显示灰色「规划中」。**新增 `PlanLimits` 字段须同步 `PENDING_ROWS`**，否则新增空头承诺；已实现能力不得误挂 `ROADMAP`。

## 关键交互定稿
- 订阅页：定价表对所有人可见（独立 `PricingTable.tsx`），付费 CTA 未登录变「请先连接钱包/签名登录」。登录后才显当前档位/订单/账本。
- 模型广场：只做目录+价格查询，**不提供 Key 转售**；赞助模型→「在 Chat 中对话」（`/chat?model=<slug>`）；其余→「配置自定义模型」`/ai/api-keys`（BYOK）。`CostEstimator` 标题「费用参考」明示是你自己的 Key。

## /ai 模块（算力市场）
- 子导航 `ComputeSubNav`（2026-10-17 重排，已删 Chat）：**`/ai/tools`(Web3 工具) → `/ai/research`(投前侦察) → `/ai/models`(模型广场) → `/ai/api-keys` → `/ai/usage` → `/ai/billing`**。`ModulePage` 提供壳层。**`/ai` 是重定向壳页 → 默认落 `/ai/tools`**（侧边栏「智能市场」点进去先看工具）。Chat 入口只在侧边栏第一项。
- **/ai/tools（Web3 工具选型，2026-10-16）**：不自研，只接以太坊官方 agent-tooling 目录的现成 MCP/Skill/CLI；31 条目全部 `integration:"none"`（页面常驻「未接入」声明）。P0=先接读数据/查链（Alchemy/DefiLlama/Slither）+ 签名流（request-wallet-sign）。红线圈：`integration:"none"` 必须显「未接入」，不得暗示可用；服务端不托管第三方密钥、不代售 key；写操作先出交易草稿再签名。
- **/ai/research（投前侦察，2026-10-17 起真实数据，不再有模拟）**：用户在签名/买币/RWA 前先来挖链。五维度，`src/lib/research/{types,dimensions,sources,engine}.ts` + `src/app/api/research/route.ts`（POST，runtime=nodejs）。**只出真实数据**：合约=Sourcify+Alchemy `eth_getCode`；链上=Alchemy 余额/nonce；代币=DefiLlama 价格/TVL；**Alchemy key 只在服务端读，不下发浏览器**。`team`/`sentiment` 无免费源 → `status:"unavailable"`，**不给任何数值与判断**。**已移除 0-100 风险分**（编造分数=假数据），改定性结论+`basis` 依据。UI `ResearchCockpit.tsx` fetch `/api/research`。易踩坑：DefiLlama `/protocol/{slug}` 的 `tvl` 是历史数组，须 `series.at(-1).totalLiquidityUSD`。

## 部署就绪（状态参考）
- 生产 env 已配齐（`SUBSCRIPTION_TREASURY_ADDRESS`、`CRON_SECRET`、`ALCHEMY_WEBHOOK_SIGNING_KEY`、`FREE_MODELS_ENABLED=1`）；三环境集一致。生产构建通过；冒烟 `/chat`200 `/ai/billing`200 `/api/health`200、匿名 POST 401。
- 用户侧待办：买 Gateway Credits、设 Budgets、轮换 `AI_GATEWAY_API_KEY`、补齐 §8.3 独立 ToS/隐私政策与 AI 披露。

## 发版 / CI（2026-10-17 决策）
- **release-please 已整体移除**：删除 `.github/workflows/release-please.yml` + `release-please-config.json` + `.release-please-manifest.json`，`.github/` 空目录一并清掉。原因：该管线「配了没产出」（无 CHANGELOG.md、无任何 tag/Release），且本项目走 Vercel Git 部署，GitHub Release/tag 非必需。
- 现状：**仓库无任何 CI workflow**。版本号真相源是 **`package.json` 的 `version`**（当前 `0.1.2-alpha`，删 manifest 未影响）；CHANGELOG 手动维护（仓库本就没生成过 CHANGELOG.md，故删除零损失）。若日后要恢复自动化，三件须成组恢复（留任一会让 workflow 报错）；若恢复需配 `RELEASE_PLEASE_TOKEN`（PAT）或开启 Actions 建 PR 权限。
- 清理散文件时的通用做法：先全仓核查引用（`src`/`docs`/`scripts`/根配置）再删，避免悬空引用；删除保持未暂存，由用户自行决定是否提交。

## 文档位置
- **项目文档在根 `docs/`**（16 份：14 专题 + `PROJECT_OVERVIEW.md` 总览 + `WEB3_TOOL_REGISTRY_PHASE1_PLAN.md`）。**全局入口先看 `docs/PROJECT_OVERVIEW.md`**（产品定位/目标/当前阶段/红线/路线图/文档索引）。
- 2026-10-17 曾短暂移到 `.workbuddy/docs/`，**现已移回根 `docs/`**；`.workbuddy/docs/` 已空。未来引用一律用 `docs/`，不要再用 `.workbuddy/docs/`。
- `.workbuddy/memory/` **未被 gitignore**（会入库 → 严禁写密钥）；`.workbuddy/c-…/`（会话副本）与 `conversation-export.md` 已 gitignore。
