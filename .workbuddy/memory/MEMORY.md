# Coolha app.coolha.com 项目记忆

> 定位 AaaS（Agent as a Service）：不卖算力、不卖 token 档位，只卖 Agent 执行与平台服务。详细历史见 `docs/PROJECT_OVERVIEW.md`。

## 基线 / 门禁
- Next **16.4.6**（`experimental.agentUpgrade="security"`）/ React 19 / TS 5.9 / Tailwind 4 / shadcn(radix-luma, neutral, cssVariables, remixicon) / Reown AppKit+wagmi / next-intl 三语。主色 `#c0e218`。
- Neon Postgres，接线 `src/lib/neon/`；迁移 `db/migrations/001`~`012`。Git coolha-com/app.coolha.com，常用分支 `agent`，Vercel Git 部署；`.env*.local`、`.eve/`、`.output/`、`.playwright-cli/` 已 gitignore。**`.workbuddy/memory/` 未被 gitignore → 严禁写密钥**。
- 质量门禁 `npm run lint` + `npx tsc --noEmit` + `npm run build`。**构建铁律**：必须 `rm -rf .next && npm run build`（safe-delete 拦 next build 自清 `.next`）；禁 `mv .next .next.old`。若 `.next` 正被 `next start` 占用，safe-delete 回收站会 `trash-failed` 拦下删除，需先停服务。
- **分支分工**：`main`=`ep-tiny-wildflower-a1kcciel`（Vercel 生产），`dev`=`ep-gentle-rain-a1zc8ojh`。本地开发走 dev：`.env.development.local` 放 dev 的 `DATABASE_URL`/`DATABASE_URL_UNPOOLED`/`NEON_AUTH_BASE_URL`；`.env.local`/`.env.production.local` 保持 main。Next 优先级 `.env.development.local` > `.env.local`。**Neon Auth 是分支级的**，换库必须同时换 `NEON_AUTH_BASE_URL`。
- `scripts/apply-migration.mjs`：默认打 dev，打生产必须 `--prod`；env 后加载者覆盖；优先 `DATABASE_URL_UNPOOLED`；命中 `ep-tiny-wildflower` 打生产告警。无迁移历史表，靠 DDL `IF NOT EXISTS` 幂等。**本地 `.env.local` 指向生产库，跑迁移=改生产库。**
- `proxy.ts` 硬屏蔽 CN（`/api/` 返 451），本地 `__geoCountry` 覆盖。授予权益时二次校验 geo header。

## Windows 本地开发坑
- 双 Node：shell 默认 22.22.2，`C:\Program Files\nodejs` 是 24.14.0；跑 dev/eve 前 `export PATH="/c/Program Files/nodejs:$PATH"` 且 `unset NODE_OPTIONS`（safe-delete shim 会 EPERM）。停服常留子进程占端口，重启前 `taskkill //F //PID`。
- **`next dev --webpack` 本机可正常 hydrate（2026-11-11 复核）**；`next dev --turbopack` 不可用（`@wagmi/connectors` 别名是绝对 Windows 路径）。Playwright 用 `domcontentloaded`（HMR 长连接使 networkidle 不触发）。dev 常态噪音：WalletConnect metadata、未连接时 nonce 400、viem tempo Critical dependency 警告，均非故障。

## env / Vercel
- 四文件：`.env.local` 基线（**值不加引号**）+ `.env.development.local` / `.env.production.local` / `.env.preview.local`（Next 不加载，仅对照）。云端新变量四文件一起改；**纯本地开关 `COOLHA_EVE_LOCAL=1` 只写 `.env.local`，绝不上传 Vercel**（`vercel env pull` 会整份覆盖该文件，pull 后需补回）。基线必含 `AI_GATEWAY_API_KEY`/`REOWN_ID`/`ALCHEMY_KEY`/`ALCHEMY_ID`。
- **`vercel env pull` 把值写成带双引号且只改 `.env.local`** → 引号致 `28P01`；另三文件仍旧值 → 连旧库。必须剥引号 + 同步三文件。
- **防 BOM**：禁 `echo | vercel env add`；用 `vercel env add NAME <env> --force --type config --value "值"`（preview 加 `--yes`）。CLI 默认存 Secret 不可回读。`vercel link` 会改写 `.env.local`；`vercel env pull` 一律写临时文件。`auth.json` 的 `expiresAt` 不可信，实测 `GET /v2/user` 为准（2026-11-11 已失效返 403 `invalidToken`）。
- Vercel 项目 `prj_m9E5DH8S20DrzD0evJheec3P4EJl`，team `team_hIqp1q3klTFP96UWJsAtEjac`。env 按环境拆分：`DATABASE_URL`/`DATABASE_URL_UNPOOLED`/`NEON_AUTH_BASE_URL` 各两条（production→main、preview+development→dev）。改 env 后需 Redeploy。`vercel env rm` 同名多条目静默不删 → 走 REST `/v9/projects/<id>/env`。
- AI Gateway key 不轮换、创建后不可取回、删除即失效、**成员离开自动停用**；生产可用 `VERCEL_OIDC_TOKEN`。
- ⚠️ **2026-11-11 实测：该 team 的 AI Gateway 已被团队级封禁**。`GET /v1/models` 200（key 有效），但任何模型 `POST /v1/chat/completions` 均 403 `{"type":"forbidden","code":"account_blocked","message":"This team is blocked from using AI Gateway"}`。四个不同模型全部复现 → 与 key/模型/代码无关，是账号授权状态。唯一正路：`vercel.com/help` 工单（附 request id）或误封走 `vercel.com/accountrecovery`；顺带查 Hobby/Pro trial、Credits 余额、Budgets、付款方式。**不要换 key/换团队绕过**（Vercel 判为规避 enforcement，可致永久停用）。解封前所有走 Gateway 的推理（含 eve Agent）必然失败。
- **env 同步 REST 范式（2026-11-11 验证）**：`PATCH /v9/projects/{id}/env/{envId}?teamId=…`，body **只带 `{"value":"…"}`**（带 `target`/`key` 会冲突错误）；回读 `GET …/env/{envId}?decrypt=true` 拿明文校验指纹；`GET /v9/projects/{id}/env` 列条目查重复。CLI token 失效时先 `npx vercel whoami` 刷新。改 env 后**生产需 Redeploy** 才生效。15:25 已把本地 `.env.local` 的 `AI_GATEWAY_API_KEY` 覆盖到云端唯一条目 `SJVNAK9wGH014044`（三环境共用），回读 sha 一致、无重复条目。

## 密钥入库铁律
**任何凭证值不得写进会入库文件**（含 `.workbuddy/memory/*.md`、`docs/`），只写「见 `.env.local`」。推送前扫 commit 快照：`git grep -nE "vck_…|sk-…|gh[pousr]_…|0x{64}|eyJ…" <sha> -- .`。被拦且未推送成功 → 从干净远端基线重提工作区，脏 commit 留本地，不 rebase/force push。例外：`scripts/siwe-smoke.mjs` Hardhat #0 公开私钥。

## 认证 / 身份（Web2 为主）
- **Web2 主登录（Neon Auth）+ 钱包 SIWE 第二凭证**，都收敛到 `users.id`。四态 L0 匿名 / L1 连钱包 / L2 已登入 / L3 已购服务；**连钱包 ≠ 登录**。账号合并不做。
- **唯一入口 `src/lib/neon/session.ts` 的 `getCurrentUser()`**：先 Neon Auth 会话再钱包会话，返回 `{subject,userId,source,address,email,name}`；**两者并存以 Web2 为准**（钱包会话可能是同机别人的）。业务路由一律用它，不直接调 `getWalletSessionFromCookies()`。
- `user_identities(kind,address,user_id)`（006）：`evm_signing`=小写地址 / `email`=小写邮箱（合流点）/ `neon_auth`=Neon user.id。`ensureWeb2User()` 按「neon_auth 已绑 → 已验证邮箱 → 新建」三级，**未验证邮箱绝不合并**；`bindWalletToUser()` 不抢占已属他人的地址。
- 前端：`auth-client.ts`=`createAuthClient()`；`useAuth.ts`=**模块级 store + `useSyncExternalStore`**（多实例各发请求会互相取消，致侧边栏永远显示未登录）。`/signin` 是 `(APP)` 外全屏独立路由：邮箱验证码 / 密码 / 注册三页签 + Google + 整宽「用钱包登入」（直开 `open({view:'Connect'})`）。`/account` 带侧边栏：资料、邮箱、密码、钱包（拒绝解绑最后一个凭证）、登出。侧边栏 `ConnectButton` 登录后显示头像+名称链 `/account`。
- **AppKit 只留 EOA**：`features.email=false`+`socials=[]`；Reown 远端配置会覆盖本地，需去 dashboard 关。法务链接指向 `coolha.com/terms`、`coolha.com/privacy`。
- **验签支持 EOA + ERC-1271 + ERC-6492**（`src/lib/web3/siwe-signature.ts`）：本地 `recoverMessageAddress` 命中即过，失败才走 `publicClient.verifyMessage`；不可用返 `SIGNATURE_VERIFY_UNAVAILABLE` → **503 不能 401**。embedded wallet 默认 Smart Account 会签 1271/6492，旧 `siwe.verify()` 必挂。
- Neon Auth 与业务库同库，`neon_auth.project_config` = 共享 SMTP + otp + 共享 Google；`/api/auth/[...path]` 代理全部方法。冒烟：build 后 `next start -p 3000` + `node scripts/siwe-smoke.mjs` → `E2E_RESULT: ALL_PASS`。

## 商业模型
- **四档订阅/BYOK/免费聊天已下线**；改为**一次性购买 Agent 服务 $19/次**，法币走 Waffo Pancake MoR（`?type=onetime&currency=USD&test=true`，测试模式不扣款不发权益，UI 如实标注）。**Waffo 用户尚未配置好，webhook/权益授予暂不做。** 四档后端代码仅留历史账本，不再宣传。
- **三条资金流永不交叉**：服务费→Coolha、模型费→上游/赞助额度、赞助 token→Vercel。合规红线是「按 token 数分档」而非「有免费模型」；AaaS 不得按 token 收费（Vercel §8.3），只收 Agent 执行/平台服务费。
- 内部 `service_orders`/`entitlements` 为真相源，每 PSP 一个 adapter，webhook 归一 `PaymentConfirmed`，只存 `payment_ref`。Agent 侧分层：x402/MPP/AP2/ACP 仅方向，未实现。**营销黑名单**：「升级获得更多 tokens」「解锁更多模型」「更快响应」「用 Coolha 调用 GPT-5」。

## 模型 / 目录同步
- 赞助模型 `isSponsorableModel = !isStealth && zdr==="all" && noTraining==="all"` 且 input ≤ `SPONSORED_MAX_INPUT_PRICE_PER_MILLION=1`；默认 `openai/gpt-oss-20b`。额度 `SPONSORED_DAILY_TOKENS=300_000`/`SPONSORED_DAILY_REQUESTS=30`（UTC 日）；熔断 `FREE_MODELS_ENABLED=0`。
- `/api/compute/playground` 门禁 403 `MODEL_NOT_SPONSORED` + `disallowPromptTraining:true`。`/api/v1/models` 字段短名 `zdr`/`no_training`。`ModelSelector` 是纯平台模型（无 BYOK 分组）。
- 目录退避（009 `model_catalog_sync.failed_at`）：401/403 用 `CATALOG_AUTH_BACKOFF_SECONDS`，其他 `CATALOG_RETRY_BACKOFF_SECONDS`；`?refresh=1` 跳过。判定**必须**用不缓存的 `readCatalogSyncMeta()`。`digest==="DYNAMIC_SERVER_USAGE"` 须 `isNextControlFlowSignal()` 重抛；`isRealGatewayFailure()` 排除 `RENDER_ABORTED`/`SYNC_IN_PROGRESS`。回归 `node scripts/verify-catalog-backoff.mjs`。

## eve / AaaS 运行时
- `eve@1.0.0-rc.9`（2026-11-11 从 rc.8 升级，`npm i eve@1.0.0-rc.9 --save-exact`，`engines.node>=24`）。`agent/`：`instructions.md`、`agent.ts`、`skills/rwa-due-diligence.md`。**零自建工具**，不建假执行点。
- **rc.8→rc.9 评估结论**：官方 changelog 仅 3 Features + 3 Bug Fixes（`ctx.ask` 的 `initialOptionId`、`executeGitHubShell` 输入错误类型、gh 锁 span、compaction 一次压缩、`defineState()` 在 workflow `"use step"` 内改为抛错），**无 Breaking Changes**。实测本项目用到的 9 个公共模块入口（`eve/channels/auth|eve|client|events|models|react|tools|sandbox|sandbox/just-bash`）文件哈希两版 **全部 SAME**，exports 100 项无增减、engines/deps 不变；变化的只有 `dist/src/acp/adapter.js` 与 CLI TUI 内部文件（未用）。**dev-host 目录文件哈希也完全一致 → Windows 下 `withEve()` 的 `./C:/...` 路径 bug 没修**，仍须走独立 Runtime。升级后 `eve info` = 0 errors / 0 warnings / **0 tools**，`eve build` 通过，Runtime health 200。
- **执行层三层收紧**：① `src/app/api/eve/v1/[...path]/route.ts` 受控代理校验会话（匿名 401）+ geo 二次校验 + 内部密钥；`agent/channels/eve.ts` 用 `coolhaSiweProxy()`；② `defaultTools:false`+`tool:false`+`approval` 空集合，`agent/tools/*.ts` 6 个 `disableTool()` 兜底，`eve info`=**0 tools**；③ sandbox 已从 Docker 改为 **JustBashSandbox**（本机无 Docker），`networkPolicy:"deny-all"`，具名 `export const environment`。⚠️ 残留：命名空间 catalog 工具（`eve__skill`、deferred/connection/task）删不掉，绝对零工具须连 skills/connections/tasks 清空。
- **不接 `withEve()`**（Windows 下 rc.8/rc.9 dev host 都把绝对路径拼成 `./C:/...`）。链路：`eve build` → `eve start --host 127.0.0.1 --port 4274` → `next.config.ts` `rewrites()` 把 `/eve/v1/*` 转 `/api/eve/v1/*`。生产须显式 `EVE_RUNTIME_ORIGIN`+`EVE_INTERNAL_SECRET`（fail-closed）；**本地用 `COOLHA_EVE_LOCAL=1`（2026-11-11 新增）同时开 rewrite 与默认 `http://127.0.0.1:4274`/占位密钥**，修掉「`next start` 也是 NODE_ENV=production → 丢 rewrite / 拿不到默认地址 → `AGENT_RUNTIME_UNREACHABLE`」。`vercel env pull` 后需补回该开关。
- **本地一键并行启动（2026-11-11）**：`npm run dev:all` → `scripts/dev-all.mjs`（零依赖，spawn 两个子进程 + 日志前缀 + 任一退出则一起收摊）。自动挑 Node>=24、去掉 `NODE_OPTIONS`、显式注入 `COOLHA_EVE_LOCAL=1` 与 `EVE_INTERNAL_SECRET=coolha-local-eve-proxy`（**eve 进程不读 `.env.local`，必须显式注入**）；端口已占用则跳过、不误杀现有服务；改了 `agent/` 用 `npm run dev:all:rebuild` 先重建 `.output`。⚠️ **不能直接 `node .output/server/index.mjs`**：Nitro 默认监听 3000，会与 Next 冲突 `EADDRINUSE`，必须走 `eve start --port 4274`。
- **模型切换是真**：`useEveAgent({headers:()=>({"x-coolha-eve-model":modelId})})` → 代理 `getPlaygroundModels()` 白名单校验注入 → `coolhaSiweProxy()` 写 `attributes.model` → `agent.ts` `defineDynamic` 每轮读取。
- 链路探活：`GET :4274/eve/v1/health` 200；带有效会话 `POST :3000/eve/v1/session` 202（2026-11-11 实测通过）。**但模型调用必失败**：上游 `account_blocked`（见 env 段）。`AGENT_RUNTIME_UNREACHABLE` 只表示 `fetch(target)` 抛错（Runtime 没起/断连），与 403 是两层不同问题；UI 已按此如实分类，不笼统报「执行失败」。
- **`/chat` 形态**：`ChatWorkbench` → `AgentWorkspace.tsx`。选 Agent + 选模型 + 文件/图片消息 + `reasoning` 折叠 + `EveToolPart` + 结果。未登录提示链 `/signin`。**输入框下不放任何免责/模型说明文案。**工具栏右侧是「历史任务」(Link `/tasks`) +「新建任务」(`agent.newSession()`)；选智能体 `<select>` 末项「全部智能服务 →」跳 `/agents`。
- **IA 归属（2026-11-11 定稿）**：`/console` 只做 AaaS 开发者控制台（调用凭证 + 任务状态 + API/MCP 接入），**整页不出现 BYOK / 自带 / 自己的 Key 等字样**；模型广场**入口**在 `/agents`（页面路由仍 `/console/models`，未迁移以免动 redirects 与多处链接）；`/tasks` = 「历史任务」，归属智能对话（Sidebar active 归 `/chat`），页内有「新建任务」回 `/chat`。共享组件 `ComputeNotes.tsx` 的口径文案已统一为 AaaS。

## 信息架构
- **主导航 5 项**：智能对话 `/chat`（第一）→ 智能服务 `/agents` → 数据和接口 `/data` → 账户和支付 `/billing` → 开发者控制台 `/console`。`/` 307→`/chat`；i18n 三语同步。
- **`/ai` 聚合模块已解散**：`/ai/tools`→`/data/tools`、`/ai/research`→`/agents/research`、`/ai/models`+`[id]`→`/console/models`、`/ai/billing`→`/billing/subscription`、`/ai/usage`→`/billing/usage`。`/api/ai/tools/[slug]` 执行点不动。旧路径由 `next.config.ts` `redirects()` 307 兜底；`/connect`、`/developers` 并入 `/console`。
- `/console/api-keys` 与 `/wallet` 已整页删除（含重定向，现 404），视同从未存在。嵌套旧克隆目录已移除，`tsconfig.json` 不再需要 `exclude: ["app.coolha.com"]`。

## 存储 / 数据隔离 / 陈列即承诺
- **本地 IndexedDB 是唯一读源，云端仅可选镜像**：`src/lib/compute/local-db.ts` + `thread-store.ts`（`mode=local` 零服务端接触 / `mode=backup` 后台镜像）。IDB 坑：`IDBIndex.delete()` 不存在→`openCursor`+`cursor.delete()`；`put` 须在事务活动期内。
- 云端历史（008 `chat_threads`/`chat_messages`，`search_tsv`+GIN）走 `chat-history.ts` + `/api/chat/threads|history`。**用户第三方 API Key 永不上行。**
- **面向终端用户查询必须带 subject 过滤**；过滤 null 主体用 `IS NOT DISTINCT FROM $1`。`authorizeHistory()` 是范式（401/403 分开）。示例数据用 `example/*` +「示例数据」+ 置灰徽章。回归 `node scripts/verify-usage-isolation.mjs`。
- **陈列即承诺**：未实现能力显灰「规划中」，已实现不挂 ROADMAP；未配置/上游失败如实报「未接入」，**绝不返回占位数值**；工具层不生成任何评分/概率/评级。

## /data/tools 与 /agents/research
- `/data/tools` 只接以太坊官方 agent-tooling 目录现成 MCP/Skill/CLI。31 条中 1 条 `live`（`alchemy-mcp-server`），其余 `none` 显「未接入」。执行点 `/api/ai/tools/[slug]`（服务端 Alchemy JSON-RPC 只读，Base+Ethereum），前端 `ToolLiveRunner.tsx` 点击才请求。接的是 Alchemy 链上数据能力，**不是官方 MCP 端点**。`live` 条目须在 `docs/ENTITLEMENT_ENFORCEMENT_STATUS.md` §14 有执行点，卡片正文用 `catalog.ts` 的 `liveScope` 写明范围。
- **Alchemy 统一到 `src/lib/alchemy/client.ts`（`server-only`）**：`ALCHEMY_KEY` 优先 / `ALCHEMY_ID` 兜底；错误分类 `NOT_CONFIGURED`/`UPSTREAM_*`/`INVALID_RESPONSE`；抛错前脱敏（key→`[redacted]`）。
- **证据信封 `src/lib/web3-tools/evidence.ts`**：`ToolResult<T>`=`ok`/`tool`/`source{provider,method,endpoint,chain,chainId,fetchedAt,latencyMs}`/`data`/`warnings`/`unknown`/`coverage`/`error`；`trace()` 保证 `ok=false` 时 `data` 必 null、`unknown` 必非空。
- `/agents/research` 五维度真实数据（`src/lib/research/*` + `POST /api/research`）：合约=Sourcify+Alchemy `eth_getCode`；链上=Alchemy 余额/nonce；代币=DefiLlama。`team`/`sentiment` 无免费源→`status:"unavailable"`。**无 0-100 风险分**。坑：DefiLlama `/protocol/{slug}` 的 `tvl` 是历史数组，须 `series.at(-1).totalLiquidityUSD`。`/agents/rwa-research` 的 BYOK 已下线，narrative API 返 410 `BYOK_RETIRED`。

## 部署 / 文档
- 生产 env 已配齐、三环境一致。用户侧待办：**先解决 AI Gateway 团队封禁**、设 Budgets、补 §8.3 ToS/隐私政策/AI 披露、Waffo 配置完成后再接 webhook。
- **release-please 已移除** → 无 CI。版本真相源 `package.json` 的 `version`（`0.1.2-alpha`），CHANGELOG 手动维护。文档在根 `docs/`（入口 `docs/PROJECT_OVERVIEW.md`）。清理散文件先全仓核查引用再删，删除保持未暂存由用户决定提交。
