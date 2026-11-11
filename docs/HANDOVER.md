# 交接与待办（2026-11-12）

> 给接手这个仓库的人 / AI 工具的入口。
> 先读 `docs/PROJECT_OVERVIEW.md`（项目是什么）和 `docs/LOCAL_DEV.md`（怎么跑起来）。
> 本文只讲现在做到哪。Waffo 收款已退出，不要再按旧文档去接支付。

---

## 1. 现在是什么样

```
智能对话（根路由 /）
  → 选中智能体 → 配置面板（模型 + 约束 + 访问模式）→ 开始任务
  → 服务端建会话（chat_sessions）→ EVE 多轮对话
  → Next.js 代理把白名单模型交给 EVE
  → EVE 用 Vercel AI SDK 的 OpenAI 兼容 Provider 调 OpenRouter
  → token 用量落 agent_usage_ledger；拿得到单价才记成本
```

访问模式（只看服务端 `AGENT_ACCESS_MODE`，请求参数和 Header 改不了）：

| 模式 | 何时生效 | 行为 |
| --- | --- | --- |
| `local_open` | 本机，且不在 Vercel 上 | 登录后可测试，不必购买 |
| `preview_open` | Vercel Preview，且分支是 `agent` 或 `cursor/*` | 同上，并有 24 小时测试预算 |
| 其他 / 生产 | 包括 `VERCEL_ENV=production` | 没有有效授权就不能执行。当前没有收款入口 |

不要使用 Vercel AI Gateway。它已被永久封禁。

---

## 2. 三档环境

| 环境 | 数据库 | 推理 | 备注 |
| --- | --- | --- | --- |
| 本地 | Neon **dev** | OpenRouter | `COOLHA_EVE_LOCAL=1` 只写本地；`AGENT_ACCESS_MODE=local_open` |
| Vercel Preview / agent | Neon **dev** | OpenRouter | `AGENT_ACCESS_MODE=preview_open` 只配在 agent 与本次预览分支 |
| Vercel Production | Neon **main** | 保留现有推理配置 | 不因本次改动开放执行，也不改数据库指向 |

Neon Marketplace 自动变量（`PGHOST` / `POSTGRES_*` / `VITE_NEON_AUTH_URL`）保留。

---

## 3. 待办

| # | 事项 | 说明 |
| --- | --- | --- |
| 1 | 公网可达的 EVE Runtime | 预览要能对话，必须有 `EVE_RUNTIME_ORIGIN` 和 `EVE_INTERNAL_SECRET`。没有就返回 503 |
| 2 | 正式商业化 | 本次不收款。以后接支付时不要把密钥写进会话或浏览器 |
| 3 | BYOK | 只预留了凭据来源类型，没有实现 |

---

## 4. 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev:all` | 同时起 Next 与 eve Runtime |
| `node scripts/apply-migration.mjs db/migrations/0XX_xxx.sql` | 默认打 dev。指向生产分支且不带 `--prod` 会拒绝执行 |
| `npm run lint` / `npx tsc --noEmit` / `rm -rf .next && npm run build` | 质量门禁。构建前确认没有 dev server |

历史迁移 `db/migrations/014_waffo_orders.sql` 保留。dev 上的退出迁移是 `016_remove_waffo_dev.sql`。

---

## 5. 别踩的坑

| 坑 | 正解 |
| --- | --- |
| 模型 id 归一化时无脑剥第一段 | `deepseek/deepseek-…` 本身就是目录里的 id；先原样查，查不到再剥前缀 |
| eve 存档跨版本续接 | 旧事件缺 `meta.position` 会让 `useEveAgent` 渲染期抛错；续接前必须自查 |
| 本地库指向生产 | 迁移前确认主机名不是 `ep-tiny-wildflower-a1kcciel` |
| 把预览开放模式抄到生产 | 服务端看到 `VERCEL_ENV=production` 会强制关闭 |
| 未授权模型静默换成默认模型 | 显式传入白名单外的 ID 返回 403 `MODEL_NOT_ALLOWED` |
| 没有单价就写 0 | 成本留 NULL。0 会被读成「这次没花钱」 |
