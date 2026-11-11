# 交接与待办（2026-11-12）

> 给接手这个仓库的人 / AI 工具的**单一入口**。
> 先读这三份：`docs/PROJECT_OVERVIEW.md`（项目是什么）、`docs/LOCAL_DEV.md`（怎么跑起来）、
> `docs/WAFFO_INTEGRATION.md`（怎么收钱）。本文只讲**现在做到哪、还差什么、别踩什么**。

---

## 1. 现在是什么样

```
智能对话（根路由 /）
  → 选中智能体 → 配置面板（模型 + 三条约束）→ 开始任务
  → 服务端建会话（chat_sessions）→ 多轮对话
  → 每次推理的 token 用量落 agent_usage_ledger，按 OpenRouter 单价折算成钱
  → 额度累加到「服务授权」（agent_service_grants）上
  → 历史任务（/tasks）列表展示，点开 ?session=<id> 续看/续聊
```

付费闸门（**19 U/次 · 30 天有效 · token 价值上限 10 USD**）：

| 位置 | 行为 |
| --- | --- |
| 开始任务（`POST /api/agents/sessions`） | 没有可用授权 → **402 PAYMENT_REQUIRED**，界面显示收银台 |
| 每次推理（`/api/eve/v1/*` 代理） | 授权用满 / 过期 → **402 QUOTA_EXHAUSTED / GRANT_EXPIRED**，请求不到上游 |
| 购买成功（Waffo webhook） | 核销订单 → 发放一份授权（30 天、$10 上限） |

投前侦察（5 维度报告引擎）已**整块下线**，对外只剩「智能对话里的付费 RWA 尽调 Agent」。

---

## 2. 三档环境（别搞混）

| 环境 | 配置文件 | 数据库 | Waffo | 备注 |
| --- | --- | --- | --- | --- |
| 本地 | `.env.local` / `.env.development.local` | **dev** `ep-gentle-rain` | `test` | `COOLHA_EVE_LOCAL=1` 只写本地 |
| Vercel Development / Preview | `.env.preview.local` | **dev** | `test` | 生产凭据不填 |
| Vercel Production | `.env.production.local` | **main** `ep-tiny-wildflower` | `prod` | Waffo 生产私钥/商品/公钥**尚未填** |

同步云端：`node scripts/sync-vercel-env.mjs`（空值不推；改完要 Redeploy）。

---

## 3. 待办（按阻塞程度排序）

### P0 —— 不做就等于功能不完整

| # | 事项 | 说明 |
| --- | --- | --- |
| 1 | **公网可达的 eve Runtime** | Agent 执行目前只有本机 `:4274`。预览/生产部署需要一台公网可达的 Runtime，配 `EVE_RUNTIME_ORIGIN` + `EVE_INTERNAL_SECRET`，否则 `/api/eve/v1/*` 一律 503 |
| 2 | **生产域名缺 `/webhook` 路由** | `app.coolha.com` 跑的是 `main` 分支，**上面没有 `/webhook`**。沙箱 webhook 若指向它，会拿到 200 但响应体是 HTML 首页 → 事件**没被处理**，订单永远不核销（已实测踩到）。要么把 `/webhook` 合并进 `main`，要么让生产域名指向 `/agent` 分支部署 |
| 3 | **Waffo 生产凭据** | 账号下**只有 1 把 test 环境的 API Key**，生产私钥不存在 → 要在 Dashboard 生产模式新建。商品要 `publish-product` 到生产；店铺要过 KYB。**验签公钥不用手工复制**：SDK 内置 PROD 公钥即为当前生产公钥（已用密码学比对确认平台未轮换 key） |
| 4 | **注册 PROD webhook 条目** | 现在只有 1 条 `testMode=true` 的条目（已指向预览部署）。要在 Dashboard 生产模式再加一条 `testMode=false`，URL 填 `https://app.coolha.com/webhook` —— 沙箱打预览、正式打生产，各自独立 |

> ✅ **已验证打通（2026-11-12）**：沙箱支付 → webhook 投递 200 → 验签通过 →
> 订单 `pending→paid` → 授权发放（$10 预算 / 30 天）→ 幂等记录落库，全链路一次跑通。
> 复现：`node scripts/waffo-e2e.mjs`（建单）+ 浏览器用测试卡 `4576 7500 0000 0110` 支付 +
> `node scripts/waffo-e2e.mjs verify`（查库）。

### P1 —— 体验与合规

| # | 事项 | 说明 |
| --- | --- | --- |
| 5 | **单价缺失时的额度兜底** | 拿不到 OpenRouter 单价 → 成本记 NULL（不编造），但也不扣额度 → 可能无限用。需一条保守策略（例如按上限封顶计） |
| 6 | **退款与已消耗额度的对账** | 当前退款作废授权，账本历史消耗不回滚（可审计）；要不要退款抵扣需产品决策 |
| 7 | **合规文档** | §8.3 ToS / 隐私政策 / AI 披露尚未补齐（Vercel 上架要求） |
| 8 | **Budgets** | Vercel 项目未设预算告警 |
| 9 | **对外程序化入口** | 投前侦察下线后，v1 的 `rwa-research` API 与 MCP 的 `rwa_research` 工具都没了；MCP 现在只剩 `alchemy_read_chain`。要让外部 Agent 采购「RWA 尽调」，需要新的程序化入口（可基于对话会话 API） |

### P2 —— 清理与一致性

| # | 事项 | 说明 |
| --- | --- | --- |
| 10 | **旧 rwa-research 遗留** | `rwa_research_profiles` / `rwa_research_orders` / `rwa_research_executions` 表与 `/api/v1/rwa/assets`、`/api/v1/rwa/markets` 仍在；确认是否保留 |
| 11 | **额度口径对外一致性** | 对外是「按次买服务」，内部用 token 价值做成本护栏 —— 不要在文案里出现 token 额度/分档（合规红线） |
| 12 | **本地孤儿进程** | `dev:all` 必须用后台任务方式起；`nohup &` 会随 shell 退出被杀掉并留下占端口的孤儿 |

---

## 4. 常用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev:all` | 同时起 Next（:3000）+ eve Runtime（:4274）。**必须用后台任务方式跑** |
| `node scripts/sessions-smoke.mjs` | 会话留档端到端（建/写/列/读/404/清理 + transcript 断言） |
| `node scripts/billing-smoke.mjs` | 付费闸门端到端（无授权 402 → 发授权 → 建会话 → 记账 → 用满 402） |
| `node scripts/metering-smoke.mjs` | 真实推理计量（走 OpenRouter → token 与金额入账） |
| `node scripts/gen-env-files.mjs` | 重新生成 5 个 env 文件（结构对齐、值从现有文件搬运） |
| `node scripts/sync-vercel-env.mjs` | 把 env 同步到 Vercel 三档环境 |
| `node scripts/check-waffo-keys.mjs` | 校验两把 webhook 验签公钥：能否解析、是否单行、是否与 SDK 内置一致（判断平台有没有轮换 key） |
| `node scripts/waffo-verify-check.mjs` | 验签回归：SDK 自动回退（prod→test）链路是否正常、公钥不匹配是否正确拒绝 |
| `node scripts/waffo-webhook.mjs list` | 列出店铺注册的 webhook 条目（含 testMode、URL、事件） |
| `node scripts/waffo-webhook.mjs set-test <url>` | 把沙箱条目指向新 URL（**本地开发填路由就用这个**） |
| `node scripts/waffo-webhook.mjs add-test <url>` | 新增一条沙箱条目（本地隧道用，可与上面并存） |
| `node scripts/waffo-webhook.mjs add-prod <url>` | 新增正式条目（testMode=false） |
| `node scripts/waffo-e2e.mjs` / `verify` | 沙箱支付端到端：建单 / 查库（订单核销 + 授权发放 + 幂等记录） |
| `node scripts/apply-migration.mjs db/migrations/0XX_xxx.sql` | 执行迁移（默认打 dev，`--prod` 打生产） |

质量门禁：`npm run lint` + `npx tsc --noEmit` + `npm run build`
（构建前必须 `rm -rf .next` 且停掉 dev 服务）。

---

## 5. 别踩的坑（都是真踩过的）

| 坑 | 正解 |
| --- | --- |
| `.env` 里写多行 PEM | 必须单行，换行写成字面 `\n` |
| Waffo 回调用 `req.json()` 读 body | 必须 `await req.text()`，否则签名对不上 |
| Waffo 签名头 `t` 用秒 | 是**毫秒** |
| 先记幂等再处理回调 | 处理成功后才记 event id，否则重投被挡掉、订单永远核销不了 |
| 以为「一个环境只能填一个 webhook URL」 | **错**。webhook 是独立条目，各带 `testMode` 标志，可以多条指向同一 URL。真正的坑是**验签用哪把公钥** |
| 生产部署只认 prod 公钥 | 沙箱事件打到生产域名会被 401。解法：两把公钥都配 + **不传 `environment`**（SDK 自动 prod→test 回退）；但**发放授权**仍按事件 `mode` 判定，防沙箱支付白嫖正式服务 |
| 只改 `WAFFO_ENVIRONMENT` 不换 key | prod 必须配套生产私钥 + 生产公钥 |
| `SUM(text)` | Postgres 42883，先 `amount::numeric` |
| 模型 id 归一化时无脑剥第一段 | `deepseek/deepseek-…` 本身就是目录里的 id；应「先原样查，查不到再剥前缀」 |
| eve 存档跨版本续接 | 旧事件缺 `meta.position` 会让 `useEveAgent` 渲染期抛错、整页崩；续接前必须自查 |
| 本地 `.env.local` 指向生产库 | 现在本地一律指 dev 分支；跑迁移前确认目标库 |
