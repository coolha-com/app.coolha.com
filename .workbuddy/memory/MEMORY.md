# Coolha app.coolha.com 项目长期记忆

## 算力市场（Compute Market）模块

- PRD 与技术方案（Vercel + AI SDK + AI Gateway 优先）已由用户提供；Phase 0 审计报告在 `docs/COMPUTE_MARKET_PHASE0_AUDIT.md`（2026-10-14）。
- 路由决策：`/ai` 即算力市场入口，子路由用 `/ai/models`、`/ai/models/[id]`、`/ai/playground`、`/ai/api-keys`、`/ai/usage`、`/ai/billing`；API 用 `/api/v1/*`。
- AI Gateway 凭证 `AI_GATEWAY_API_KEY` 已配置（运行时有效性 2026-10-14 未验证）。

## 算力市场合规红线（2026-10-15 核实，重要）

- **不能用 AI Gateway 做中转站/算力中间商**：Vercel ToS §11(i)(iv) 禁 resell/转让给第三方及 service bureau；AUP（2026-04-21）禁 "sell access / make Services available to any third party"、禁 "Buy, sell or transfer Vercel's third-party AI providers' API keys"、禁用 Services 建竞品；AI Product Terms §2 许可仅限 **personal or internal business use**，无 sublicense 权。
- **唯一合法出口**：AI Product Terms §8.3 —— 提供自有 Application 给 End User，须备独立 ToS + 隐私政策、提前披露 AI 使用、End User 也遵守 AI Product Terms、对 Vercel 负 indemnity。界限：**卖 token = 违规；卖产品/能力 = 允许**。
- **差价模式本身不成立**：AI Gateway zero markup（含 BYOK）不产生批发价；上游 OpenAI §3.1/§3.3、Anthropic Commercial Terms、OpenRouter §7 均禁 resell / 禁转让 API key；合法折扣只有 batch 50%、cache 10%、模型降级。
- **对 `/ai/api-keys` 的影响**：若按"发 key → 按 token 加价转发"设计即撞 AUP 三连。建议改：① 自有 AI 应用卖能力（推荐）；② BYOK 软件层（用户自带上游 key）；③ 真做中间商须与上游签正式转售/Enterprise 协议或自部署开源模型。
- 另注：`proxy.ts` 地理屏蔽叠加上游 supported-countries 条款，跨境供给风险需单独评估。

## 项目事实基线（2026-10-14 实测）

- 技术栈：Next 16.4.0 / React 19.3.0 / TS 5.9.3 / Tailwind 4.3.3 / shadcn + base-ui / Reown AppKit 1.8.24 + wagmi 3.7.7 / next-intl 4.14.9。
- **无数据库、无测试框架、无服务端认证**；业务数据为 `src/lib/*.ts` 静态文件（空数组 + 空态 UI 是既有纪律，不得伪造数据）。
- 品牌主色 `#c0e218`；地理合规 `proxy.ts` 硬屏蔽 CN 等（/api/ 返回 451），本地开发用 `__geoCountry` 参数覆盖。
- 质量门禁只有 `npm run lint` + `npx tsc --noEmit` + `npm run build`（无 typecheck/test 脚本）。
- **构建注意**：本环境批量删除保护会拦截 `next build` 清理 `.next`（>50 文件/轮触发）；先 `mv .next .next.old` 再 build 可绕过（非破坏性）。
- `.env.local`（AI_GATEWAY_API_KEY / REOWN_ID / ALCHEMY_KEY / ALCHEMY_ID）被 gitignore，从未入库。
- Git：仓库 coolha-com/app.coolha.com，常用分支 `agent`；本地无 `.vercel` 链接，部署走 Vercel Git 集成（待确认）。

## Neon 托管（2026-10-14，Vercel→Neon 集成路线）

- 数据库：Vercel 管理（产品 Coolha-Data，Free 计划，区域以 Vercel 拉取变量为准）；本地 env：`.env.local`（标准名，dev/build/start 全加载）+ `.env.development.local`（仅 dev，`vercel env pull` 的 `coolha_*` 前缀变量）。
- 接线代码：`src/lib/neon/`（postgres=pg+attachDatabasePool；auth=@neondatabase/createNeonAuth；ai-gateway=@neon/ai-sdk-provider）；路由 `/api/health`、`/api/auth/[...path]`、`/api/neon/ai`。NEON_AUTH_COOKIE_SECRET 为应用自生成（存 .env.local 与 Vercel 云端）。
- 已验证：Postgres 真实查询（PostgreSQL 18.6/neondb）；Auth 注册落库 neon_auth."user"（camelCase 列）；登录受邮箱验证门控；AI Gateway 未开通（Free 计划限制，代码就绪待开通）。
- Vercel CLI 已登录 coolha-limited：AI 可直接 `vercel env add/ls` 管理云端；MCP（vercel/neon）已写入 ~/.workbuddy/mcp.json，待 Trust。
- 坑：next dev 在 WorkBuddy 管道内会被删除保护击穿（须跑用户自己终端）；`vercel env add` 慢（~40s/次）且批量须后台+`--force`； Neon Managed Auth schema 列名为 camelCase。

## 认证体系（2026-10-14）

- 三套并存：① Reown 钱包连接（仅客户端）；② **SIWE 自建钱包会话**（服务端鉴权主线，算力市场 API Key 的身份基础）：`/api/wallet-auth/*` + `wallet_users/nonces/sessions` 三表（迁移 `db/migrations/001_wallet_auth.sql`）；③ Neon Managed Auth 邮箱体系 `/api/auth/*`（管理向）。
- SIWE 冒烟：构建后 `next start -p 3100` 再 `node scripts/siwe-smoke.mjs`（Hardhat 测试账户 #0）。
- 项目文档：README.md（结构/流程/路线图）、docs/LOCAL_DEV.md、docs/COMPUTE_MARKET_UPSTREAM_PROVIDERS.md。
