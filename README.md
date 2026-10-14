# app.coolha.com

Coolha 应用前端（Web4 市场平台）：算力市场（Compute Market）、智能体市场、代币化市场、钱包等模块。
技术栈：**Next.js 16（App Router）+ React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui**；Web3 栈 Reown AppKit + wagmi + viem；数据库与托管后端为 **Neon（Lakebase Postgres）经 Vercel 集成管理**。

## 目录结构

```
src/
├── app/
│   ├── (APP)/                    # 应用主体（Sidebar + NavBar 布局）
│   │   ├── ai/                   # 算力市场模块（/ai/*）
│   │   │   ├── models/           #   模型广场 + 详情页（/ai/models/[id]）
│   │   │   ├── playground/       #   在线测试（Mock 流式）
│   │   │   ├── api-keys/ usage/ billing/   # Phase 2-4 界面壳
│   │   └── dashboard/ agent/ rwa/ wallet/ market/   # 其他模块
│   ├── api/
│   │   ├── wallet-auth/          # SIWE 钱包登录（nonce/verify/session/signout）
│   │   ├── compute/playground/   # 算力市场 Mock 流式路由
│   │   ├── auth/[...path]/       # Neon Managed Auth（邮箱体系）catch-all
│   │   ├── health/               # 服务健康检查（真实 DB ping）
│   │   └── neon/ai/              # Neon AI Gateway 连通性路由（待开通）
│   ├── error.tsx / not-found.tsx # 全局边界
│   └── layout.tsx / page.tsx     # 根布局与落地页
├── components/
│   ├── compute/                  # 算力市场组件（ModelCard/ModelsBrowser/PlaygroundChat 等）
│   ├── web3/                     # ConnectButton / WalletSignIn
│   └── ui/                       # shadcn 组件
├── lib/
│   ├── compute/                  # 算力市场数据层（types/catalog/service/mock-replies）
│   └── neon/                     # Neon 接线（postgres/auth/ai-gateway/wallet-auth）
├── hooks/useWalletAuth.ts        # SIWE 客户端 hook
├── config/                       # Wagmi/AppKit/Theme 配置
└── i18n/                         # next-intl（zh-Hans/zh-Hant/en）

db/migrations/                    # 数据库迁移（对 Neon 执行，用 DATABASE_URL_UNPOOLED）
scripts/siwe-smoke.mjs            # SIWE 端到端冒烟（需先构建并 next start -p 3100）
docs/                             # 审计报告 / 本地开发指南 / 上游供应商方案
proxy.ts                          # Next 16 中间件：地理合规（CN 等地区硬屏蔽）
```

## 本地开发

```bash
npm run dev            # http://localhost:3000（务必在你自己的终端运行，见 docs/LOCAL_DEV.md）
npx tsc --noEmit       # 类型检查
npm run lint           # lint
npm run build          # 生产构建
```

- **dev 服务器必须在个人终端运行**：工作区命令管道内的删除保护会击穿 `next dev`。
- 环境文件：`.env.local`（标准名变量 + 应用密钥，dev/build/start 全加载）+ `.env.development.local`（仅 dev，`vercel env pull` 产物）。改 env 后重启 dev。详见 `docs/LOCAL_DEV.md`。
- 生产模式本地验证：`npx next start -p 3100`（需先 build；运行时不写文件，不受删除保护影响）。

## 云端（Vercel + Neon）

- 部署：Vercel（项目 `coolha/app.coolha.com`，Git 集成自动部署）。
- 数据库：Neon 经 Vercel→Neon 集成管理（产品 Coolha-Data）。环境变量以 `coolha_*` 前缀拉取；**应用代码读标准名**（`DATABASE_URL` / `NEON_AUTH_BASE_URL` / `NEON_AUTH_COOKIE_SECRET` 等），标准名变量已由 CLI 写入云端三环境。
- AI 直管云端：Vercel CLI 已登录（`vercel env ls/add`）；MCP（vercel / neon）已配置于 `~/.workbuddy/mcp.json`，待连接器页 Trust。
- 数据库操作：应用流量走 `DATABASE_URL`（pooled）；迁移/DDL 走 `DATABASE_URL_UNPOOLED`（direct）。

## 认证体系（三套并存，按场景选用）

| 体系 | 用途 | 入口 |
|---|---|---|
| Reown 钱包连接 | 前端身份展示、链上交互 | `ConnectButton`（客户端） |
| **SIWE 钱包会话（自建）** | 服务端鉴权、API Key 绑定（算力市场） | 后端 `/api/wallet-auth/*` 已就绪并通过 8/8 端到端验证；UI 入口随 Phase 2 API Key 功能提供（组件/hook 已就席） |
| Neon Managed Auth | 邮箱密码登录（管理向） | `/api/auth/*` |

SIWE 流程：连接钱包 → `GET /api/wallet-auth/nonce` → 钱包签名（EIP-4361）→ `POST /api/wallet-auth/verify` → httpOnly 会话 Cookie（7 天，服务端可撤销）。数据表见 `db/migrations/001_wallet_auth.sql`。冒烟：`node scripts/siwe-smoke.mjs`（对 :3100）。

## 当前状态与路线图

- ✅ Phase 0：项目审计（`docs/COMPUTE_MARKET_PHASE0_AUDIT.md`）
- ✅ Phase 1：算力市场前端 MVP（/ai/* 六页面 + Mock 流式 + 成本估算器）
- ✅ Neon 接线：Postgres 真实查询 / Managed Auth / wallet-auth 迁移（已实测）
- 🔜 Phase 2：真实模型调用（AI SDK + AI Gateway，`AI_GATEWAY_API_KEY` 已配置）+ 用户 API Key
- 🔜 Phase 3：算力市场数据库 Schema（compute_* 表）+ 账本 + 限额
- 🔜 Phase 4：稳定币充值（链上验证 + 幂等入账）

质量门禁：`npm run lint` + `npx tsc --noEmit` + `npm run build`（无测试框架；关键流程用 `scripts/` 冒烟脚本）。

## 品牌与合规

- 品牌主色 `#c0e218`；地理合规：中国大陆等地区硬屏蔽（`proxy.ts`，`/api/*` 返回 451）。
