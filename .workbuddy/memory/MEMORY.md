# Coolha app.coolha.com 项目长期记忆

## 算力市场（Compute Market）模块

- PRD 与技术方案（Vercel + AI SDK + AI Gateway 优先）已由用户提供；Phase 0 审计报告在 `docs/COMPUTE_MARKET_PHASE0_AUDIT.md`（2026-10-14）。
- 路由决策：`/ai` 即算力市场入口，子路由用 `/ai/models`、`/ai/models/[id]`、`/ai/playground`、`/ai/api-keys`、`/ai/usage`、`/ai/billing`；API 用 `/api/v1/*`。
- AI Gateway 凭证 `AI_GATEWAY_API_KEY` 已配置（运行时有效性 2026-10-14 未验证）。

## 算力市场合规红线（2026-10-15 核实，重要）

- **红线**：Vercel ToS §11(i)(iv) 禁 resell/转让给第三方及 service bureau；AUP（2026-04-21）禁 "sell access / make Services available to any third party"、禁 "Buy, sell or transfer Vercel's third-party AI providers' API keys"、禁用 Services 建竞品；AI Product Terms §2 许可仅限 **personal or internal business use**，无 sublicense 权。
- **但官方给 router 开了绿灯**：KB《How to build your own AI model router》明写 "routing can be offered as a stand-alone product itself"、"your keys"、"/models 可被你的 router 重新暴露为自己的"。→ 真正红线是**向外颁发 API key/端点让第三方直连 Gateway**；"用户在你的产品内用"是 §8.3 认可形态（须备独立 ToS+隐私政策、提前披露 AI、End User 也守 AI Product Terms、对 Vercel 负 indemnity）。界限：**卖 token = 违规；卖产品/能力 = 允许**。
- **AI SDK ≠ AI Gateway**：AI SDK 开源，`@ai-sdk/openai-compatible` 的 `createOpenAICompatible({ baseURL })` 可直连任意 OpenAI 兼容端点。**不经 ai-gateway.vercel.sh 即不适用上述所有条款**。
- **Gateway BYOK 的三个限制**：仅限 catalog 内 provider（自选自上游进不来）、仅限 paid tier、availability fallback 会在你的 key 失败时改用 Vercel 凭证并扣你的 Credits。
- **差价模式不成立**：Gateway zero markup（含 BYOK）无批发价；上游 OpenAI §3.1/§3.3、Anthropic Commercial Terms、OpenRouter §7、硅基流动协议均禁 resell / 禁转让 API key。合法差价来源只有：协议价（需商务谈判+真实量级）、batch 50%、cache 10%、模型降级。市面 70–90% 折扣供给来自薅额度/拆订阅/盗刷卡/跨区账号（Anthropic 2026-02 已点名打击）。
- **对 `/ai/api-keys` 的影响**：按"发 key → 按 token 加价转发"设计即撞 AUP 三连。建议：① 自有 AI 应用卖能力（推荐）；② 用户自带上游 key 的 BYOK 软件层；③ 真做中间商须与上游签正式转售/Enterprise 协议或自部署开源模型。
- **推荐架构**：AI SDK 保留 + 自建薄路由层（provider 注册、failover、token 计量、成本追踪）+ 直连自选上游。Gateway 只在用其 catalog 时才值得付费。
- **云厂商经销路线不适用**：腾讯云 TokenHub 经销准入≈注册资本 ≥500 万 / 成立满 1 年 / 人员 ≥5 人 / 5 万保证金，面向有销售团队与渠道指标的公司；小团队即便通过也拿不到价格优势。
- **行业定论**：API 套利位置被消灭是行业设计（公开定价、无库存、无地域差价、边际成本恒定 → 无套利空间）。禁的是套利不是路由。剩余三条路：产品方（卖结果）/ BYOK 软件方（卖软件）/ 自建算力方（自购 GPU 部署开源模型）。
- 另注：`proxy.ts` 地理屏蔽叠加上游 supported-countries 条款，跨境供给风险需单独评估。

## 项目事实基线（2026-10-14 实测）

- 技术栈：Next 16.4.0 / React 19.3.0 / TS 5.9.3 / Tailwind 4.3.3 / shadcn + base-ui / Reown AppKit 1.8.24 + wagmi 3.7.7 / next-intl 4.14.9。
- **无数据库、无测试框架、无服务端认证**；业务数据为 `src/lib/*.ts` 静态文件（空数组 + 空态 UI 是既有纪律，不得伪造数据）。
- 品牌主色 `#c0e218`；地理合规 `proxy.ts` 硬屏蔽 CN 等（/api/ 返回 451），本地开发用 `__geoCountry` 参数覆盖。
- 质量门禁只有 `npm run lint` + `npx tsc --noEmit` + `npm run build`（无 typecheck/test 脚本）。
- **构建注意（2026-10-15 更正）**：本环境的 safe-delete 保护会拦截 `next build` 内部清理 `.next`，报 `SAFE_DELETE_BULK_GUARD_ERROR` → 直接 build 会失败。**正确做法：`rm -rf .next && npm run build`**（手动 rm 能成功，只有 next 内部的批量删除被拦）。**禁止**用 `mv .next .next.old` 绕过后不清理——用户明确反感遗留这类占空间（单个可达 423MB）的目录。build 后确认无 `.next.old-*` 残留。
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
