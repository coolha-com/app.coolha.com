# 本地开发指南（Neon via Vercel 托管）

## 环境文件地图

| 文件 | 加载时机 | 内容 |
|---|---|---|
| `.env.local` | dev / build / start 都加载（test 除外） | 应用密钥（`REOWN_ID`、`AI_GATEWAY_API_KEY`、`ALCHEMY_KEY/ID`、`VERCEL_OIDC_TOKEN`）+ 标准名 Neon 变量（`DATABASE_URL`、`DATABASE_URL_UNPOOLED`、`NEON_AUTH_BASE_URL`、`NEON_AUTH_COOKIE_SECRET`） |
| `.env.development.local` | **仅 `next dev`** 加载 | `vercel env pull` 写入的 `coolha_*` 前缀变量（Vercel→Neon 集成产物） |

加载顺序（先定义者胜，后者不覆盖）：`.env.development.local` → `.env.local` → `.env.development` → `.env`。全部被 `.gitignore` 的 `.env*` 覆盖，不会入库。

## 日常命令

```bash
npm run dev            # http://localhost:3000
npx tsc --noEmit       # 类型检查
npm run lint           # lint
```

**改 env 文件后必须重启 dev**——Next.js 只在进程启动时读取 env 文件。

## ⚠️ 重要：dev 服务器要在你自己的终端跑

本工作区（WorkBuddy 命令管道）有批量删除保护：`next dev` 运行时持续重写 `.next/dev`，单轮删除超过 50 个文件就会被保护层击穿进程（日志出现 `SAFE_DELETE_BULK_CONFIRM_REQUIRED` 后 dev 退出）。

- **在你自己的 PowerShell/终端跑 `npm run dev` 不受此影响**（删除保护只注入 WorkBuddy  spawn 的进程）。
- 经我发起的 dev 进程随时可能被击穿——我只在必要时短寿命使用，正式开发以你的终端为准。
- 我做端到端验证时用生产服务器（`next start` 运行时不删文件，不受影响）。

## 数据库操作

| 场景 | 用哪个 |
|---|---|
| 应用查询 | `DATABASE_URL`（pooled，代码已接线：`src/lib/neon/postgres.ts`） |
| 迁移 / DDL / dump | `DATABASE_URL_UNPOOLED`（direct，PgBouncer 事务模式不支持会话级操作） |
| 临时 SQL | `node -e` + `pg`（`DATABASE_URL` 已在 env，无需手输） |

## Neon 服务接线状态（2026-10-14 实测）

| 服务 | 状态 | 证明 |
|---|---|---|
| Lakebase Postgres | ✅ 已接线 | `/api/health` 返回 `neondb · PostgreSQL 18.6`；测试用户真实落库 `neon_auth."user"` |
| Auth（Managed Better Auth） | ✅ 已接线 | `POST /api/auth/sign-up/email` 创建用户成功；完整 schema（user/session/account/jwks/organization…）在位 |
| AI Gateway | ❌ 未开通 | Vercel 集成未拉取 `NEON_AI_GATEWAY_*`；Neon 免费计划不提供 Foundation Model 访问。代码已就绪（`src/lib/neon/ai-gateway.ts`），开通后零改动 |
| Functions | 未使用 | 应用 API 由 Next.js Route Handlers 承担（Neon 推荐的 full-stack 架构） |

## 已知事项与待办

1. **Auth 登录受邮箱验证门控**：`sign-in/email` 对未验证邮箱返回 `EMAIL_NOT_VERIFIED`。开发分支可在 Neon 控制台关闭 "Verify email at signup"，或用真实邮箱收验证码（共享 SMTP 可发信）。
2. **Vercel 云端变量前缀**：Vercel→Neon 集成写入的是 `coolha_*` 前缀名，与应用代码读的标准名不一致——已通过 CLI 把标准名变量补进云端三个环境（生产/预览/开发）。长期建议：Vercel 控制台 → Storage → Neon 集成 → Environment Variable Prefix 清空，之后 `vercel env pull` 即得标准名。
3. **重新拉取变量的正确姿势**：`vercel env pull .env.development.local` 会整体覆盖该文件；`.env.local` 不受影响，应用密钥与标准名 Neon 变量以 `.env.local` 为准。
