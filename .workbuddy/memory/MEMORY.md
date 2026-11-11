# Coolha app.coolha.com 项目记忆

> 定位 AaaS（Agent as a Service）：不卖算力、不卖 token 档位，只卖 Agent 执行与平台服务。

## 基线 / 门禁
- Next 16.4.6（experimental.agentUpgrade="security"）/ React 19 / TS 5.9 / Tailwind 4 / shadcn(radix-luma) / Reown AppKit+wagmi / next-intl 三语。主色 #c0e218。
- Neon Postgres（src/lib/neon/，迁移 001~014）。Git coolha-com/app.coolha.com，分支 agent，Vercel Git 部署。.workbuddy/memory/ 未被 gitignore → 严禁写密钥。
- 门禁：npm run lint + npx tsc --noEmit + npm run build。构建铁律：rm -rf .next && npm run build（safe-delete 拦自清）；.next 被 next start 占用时先停服。
- 分支分工：main=ep-tiny-wildflower-a1kcciel（生产），dev=ep-gentle-rain-a1zc8ojh。本地开发走 dev（.env.development.local 放 dev 库，.env.local 保持 main）。Neon Auth 分支级，换库须同换 NEON_AUTH_BASE_URL。

## Windows 本地开发
- 双 Node：默认 22.22.2，`C:\Program Files\nodejs`=24.14.0；跑 dev/eve 前 export PATH 指 24 并 unset NODE_OPTIONS。停服常留子进程，重启前 taskkill。
- next dev --webpack 可 hydrate；--turbopack 不可用（wagmi 别名绝对路径）。

## env / Vercel
- 四文件：.env.local（基线，值不加引号）+ .env.development.local/.env.production.local/.env.preview.local（Next 不加载，仅对照）。COOLHA_EVE_LOCAL=1 纯本地开关只写 .env.local，绝不上传。
- ⚠️ 2026-11-11 实测：该 team AI Gateway 被团队级封禁，POST /v1/chat/completions 全 403 account_blocked。解封前所有 Gateway 推理（含 eve）必失败；正路 vercel.com/help 工单，勿换 key/换 team 绕过。
- 推理层改走 OpenRouter：INFERENCE_BASE_URL/API_KEY/GATEWAY_NAME/MODELS/DEFAULT_MODEL/CONTEXT_WINDOW，当前仅 deepseek/deepseek-v4.1-flash-1017。5 个 env 文件已对齐（example 的 key 留空）。仅本地镜像，生产 / eve Runtime 主机需手动配。

## 密钥 / 认证
- 任何凭证值不得写会入库文件。推送前 git grep 扫快照。
- Web2 主登录（Neon Auth）+ 钱包 SIWE 第二凭证，收敛 users.id。唯一入口 src/lib/neon/session.ts 的 getCurrentUser()。/signin 全屏独立路由；/account 带侧栏（登录后链接已改 /settings/account）。
- 验签支持 EOA+ERC-1271+ERC-6492；不可用返 503 SIGNATURE_VERIFY_UNAVAILABLE。

## 商业模型
- 四档/BYOK/免费聊天已下线；改为一次性购买 Agent 服务 $19/次（Waffo，测试模式）。三条资金流永不交叉；AaaS 不得按 token 收费。
- 营销黑名单：「升级获得更多 tokens」「解锁更多模型」「更快响应」「用 Coolha 调用 GPT-5」。

## Waffo 收款（2026-11-11 接入，test 模式）
- SDK `@waffo/pancake-ts@0.28.0`。链路：POST /api/waffo/checkout（需登录）→ 建 pending 单（`WO_<uuid>` 当 orderMerchantExternalId）→ `client.checkout.authenticated.create` → 前端跳 checkoutUrl → Waffo POST 根路由 `/webhook` → verifyWebhook → 核销 paid。
- 代码：`src/lib/waffo/client.ts`（单例/校验）、`src/lib/neon/waffo.ts`（账本）、`src/app/api/waffo/checkout/route.ts`、`src/app/webhook/route.ts`、迁移 014（waffo_orders + waffo_webhook_events）。详见 `docs/WAFFO_INTEGRATION.md`。
- 幂等靠**状态机**（paid 仅从 pending 迁入、refunded 仅从 pending/paid 迁入 → 退款后不被重投复活）；event id **处理成功后才记**（先记会挡掉 Waffo 重投→丢单）。必须 `await req.text()` 读原始体。
- 三个必踩的坑：env 里 **PEM 必须单行**（多行被解析器截断→SDK 抛错→验签全败）；变量名只用 `WAFFO_WEBHOOK_{TEST,PROD}_PUBLIC_KEY`；签名头 `t` 是**毫秒**不是秒。
- env：WAFFO_MERCHANT_ID/PRIVATE_KEY/STORE_ID/ENVIRONMENT/PRODUCT_ID/CURRENCY/WEBHOOK_TEST_PUBLIC_KEY，`.env.development.local`+`.env.local`+`.env.local.example` 已对齐。
- ⚠️ **扣减闸门未建**：$19 买几次、怎么扣、是否过期待用户拍板；当前只记账不发放。上生产还需 KYB、换生产 key+公钥、publish 商品。

## eve / AaaS 运行时
- eve@1.0.0-rc.9（engines.node>=24）。agent/ 零自建工具。不接 withEve()（Windows 绝对路径 bug）；链路 eve build → eve start --port 4274 → next.config rewrites /eve/v1/* → /api/eve/v1/*。本地 npm run dev:all 并行起 Next+eve，注入 COOLHA_EVE_LOCAL=1 + EVE_INTERNAL_SECRET。
- 代理 src/app/api/eve/v1/[...path]/route.ts 校验会话+geo+内部密钥。模型切换真：useEveAgent headers x-coolha-eve-model → 代理注入 → agent.ts defineDynamic 每轮读。

## 信息架构（2026-11 近期改动）
- /chat 已改为根路由 /；agents 侧栏导航删除，入口改为 / 上 AgentSelector 下拉框（含「全部智能服务 →」跳 /agents）。
- 路由迁移：/console/models(+:id)→/agents/models、/rwa→/data/rwa、/account→/settings/account、/chat→/（next.config redirects 兜底，permanent:false）。
- /agents 与 /tasks 路由下智能对话高亮（Sidebar active 归 /）。
- 已下线 /api/compute/playground（route.ts 已删）。
- **对话即任务**（2026-11-11 落地）：选中智能体 → 主区出现配置面板（模型 + RWA 三条约束）→「开始任务」创建服务端会话 → 才进入对话；对话整段存「历史任务」(`/tasks`)，点条目跳 `/?session=<id>` 续看。`/agents/rwa-research` 与 `/ai/agents/rwa-research` 已 307 到 `/`（旧 rwa-research 管线代码仍在但 UI 不可达）。

## 会话留档（chat_sessions）
- 表 `chat_sessions`（迁移 013 + 014 加 transcript 列）：id / subject / agent_id / title / config_json / eve_session / eve_events / transcript / preview / status。全部按 subject 隔离，读写走 `src/lib/neon/chat-sessions.ts`，API 在 `/api/agents/sessions[/id]`。
- **两份存档各有分工**：`eve_session`+`eve_events` 给 eve 续接（SDK 私有结构，跨版本可能读不了）；`transcript` 是我们自己投影的 role+parts，与 eve 版本无关，**回看永远靠它**。渲染时 `transcript` 在前 + eve 实时消息按 id 去重合并。
- **续接前必须自查**：eve 事件需 `meta.position` 为 number 且 type 形如 `family.action`（`agent/agent.ts` 侧 eve ≥27 才可读），否则 `useEveAgent` 在**渲染期**抛错把整页带崩到 error boundary。`canResumeEvents()` 拦截 → 不续接、给提示条、照常显示 transcript。
- 回归脚本：`node scripts/sessions-smoke.mjs`（钱包 SIWE 登录 → 建/写/列/读/404/清理，断言 transcript）。

## 已知缺陷
- `src/lib/neon/waffo.ts:281` `readWaffoPurchaseSummary` 报 **42883 function sum(text) does not exist**（金额列是 text，sum() 要 numeric）。已被 catch，不影响页面但每次访问 /billing/subscription 都刷错误日志。

## 存储 / 隔离
- 本地 IndexedDB 唯一读源，云端可选镜像。用户第三方 Key 永不上行。终端查询必带 subject 过滤。

## 部署
- 生产 env 三环境一致。待办：解 AI Gateway 封禁、Budgets、§8.3 ToS/隐私/AI 披露；Waffo 上生产（KYB + 换生产 key/公钥 + publish 商品）与按次扣减闸门。

## 本地 dev 进程（踩坑）
- `npm run dev:all`（`scripts/dev-all.mjs`）起 Next + eve。**必须用 run_in_background 起**；用 `nohup ... &` 会随 shell 退出被连带杀掉，且留下一堆占端口的孤儿进程（表现为「dev:all 报 3000 已在运行，跳过启动」，实际跑的是上一个孤儿）。
- 孤儿清理：PowerShell 按端口杀（`Get-NetTCPConnection -LocalPort 3000,4274` → `Stop-Process -Force`）。
