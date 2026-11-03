# app.coolha.com

> **Coolha 应用端** —— 面向 Web3 + AI 的 Agent Market 与工具执行层。
> 线上：https://app.coolha.com ｜ 官网：https://coolha.com

---

## 这是什么

一个 Next.js 全栈应用，包含四块：

| 模块 | 路径 | 说明 |
|---|---|---|
| **Web3 工具层** | `/ai/tools` | 31 个链上工具的选型目录，以及**服务端真实执行点**（见下） |
| **AI 研究舱** | `/ai/research` | 多维度链上/基本面研究，含 team 与 sentiment 维度 |
| **AI 对话与计算** | `/chat`、`/api/compute` | AI SDK 对话流、计算任务 |
| **订阅与钱包** | `/api/subscription`、`/api/wallet-auth` | 订阅计费、SIWE 钱包认证 |

技术栈：Next.js 16（App Router）+ React 19 + TypeScript + Tailwind CSS 4 + Neon（Postgres / Auth / AI Gateway）+ AI SDK + wagmi / Reown AppKit。

---

## ⚠️ 工具目录的真实状态（请勿夸大）

`/ai/tools` 展示 31 个工具条目。**截至目前，只有 1 条真正接通了服务端执行点**：

| 工具 | 状态 | 说明 |
|---|---|---|
| **Alchemy MCP Server** | ✅ `integration: "live"` | 服务端 Alchemy 读链。真实执行点：`GET /api/ai/tools/alchemy-mcp-server` |
| 其余 30 条 | ⚠️ `integration: "none"` | **仅为静态目录条目**，无调用入口，页面上会明确标注「未接入」 |

**诚实口径是硬性要求**：
- 未接入的工具 → `404` + `status: "not_integrated"`
- 服务端凭证缺失 → `503` + `status: "not_configured"`
- 上游异常 → `502` + `status: "upstream_error"`
- **任何情况下都不返回模拟或占位的链上数据。** 取不到的字段返回 `null` 并在 `unknown[]` 中列明原因。

### 手动验证

```bash
# 已接入 —— 真实链上读数
curl "http://localhost:3000/api/ai/tools/alchemy-mcp-server?chain=ethereum"

# 未接入 —— 应返回 404 与 not_integrated
curl "http://localhost:3000/api/ai/tools/<其他工具 id>"

# 凭证未配置 —— 应返回 503 与 not_configured
```

### 安全约定

- Alchemy 密钥**只在服务端读取**（`import "server-only"`），路由声明 `runtime = "nodejs"`。
- 错误信息返回前会抹除密钥值，避免上游错误把凭证带进响应体。
- 进程内滑动窗口限流：20 次/分钟/客户端 IP。

---

## 本地运行

```bash
npm install

# 开发
npm run dev          # next dev --webpack

# 生产构建
npm run build        # next build --webpack

# 启动生产服务
npm start

# 代码检查
npm run lint
```

> **构建铁律**：构建前执行 `rm -rf .next && npm run build`。
> **禁止**在 dev server 运行期间清理 `.next` —— 会导致运行期崩溃。
> 拉取云端环境变量后需**剥掉引号**并同步四份 env 文件；**禁止**用 `echo | vercel env add` 写入。

---

## 环境变量

> 以下**仅为变量名**。**任何密钥值都不得写入本仓库、提交记录或文档。**

| 变量名 | 用途 |
|---|---|
| `DATABASE_URL` | Neon Postgres 连接串 |
| `ALCHEMY_KEY` | Alchemy RPC 密钥（`/ai/tools` 读链执行点） |
| `ALCHEMY_ID` | Alchemy 应用 ID（`ALCHEMY_KEY` 的兜底） |
| `ALCHEMY_WEBHOOK_SIGNING_KEY` | Alchemy Webhook 签名校验 |
| `AI_GATEWAY_API_KEY` | AI 网关密钥 |
| `AI_GATEWAY_BASE_URL` | AI 网关地址 |
| `AI_GATEWAY_DISALLOW_TRAINING` | 是否禁止训练用途 |
| `NEON_AI_GATEWAY_BASE_URL` / `NEON_AI_GATEWAY_MODEL` / `NEON_AI_GATEWAY_TOKEN` | Neon AI Gateway |
| `NEON_AUTH_BASE_URL` / `NEON_AUTH_COOKIE_SECRET` | Neon Auth |
| `REOWN_ID` / `NEXT_PUBLIC_REOWN_ID` | Reown AppKit 项目 ID |
| `NEXT_PUBLIC_SIWE_ONECLICK` | SIWE 一键登录开关 |
| `SUBSCRIPTION_TREASURY_ADDRESS` | 订阅收款地址 |
| `CRON_SECRET` | 定时任务鉴权 |
| `CATALOG_REFRESH_TOKEN` | 工具目录刷新鉴权 |
| `FREE_MODELS_ENABLED` | 免费模型通道开关 |
| `GEO_BLOCKED_COUNTRIES` / `GEO_HARD_BLOCKED_COUNTRIES` / `GEO_SOFT_GATED_COUNTRIES` | 地区策略 |
| `NEXT_PUBLIC_APP_VERSION` | 版本号（可公开） |

### 健康检查

`GET /api/health` 返回各依赖的**配置状态**（`configured` / `ok` / `detail`），含 `alchemy` 字段。
只报配置是否存在，**不做实时上游探测** —— 健康检查不该消耗付费配额。

---

## API 路由一览

```
/api/ai/tools/[slug]   GET   工具执行点（当前仅 alchemy-mcp-server 真实可用）
/api/health            GET   依赖配置状态
/api/chat              POST  AI 对话
/api/compute           POST  计算任务
/api/research          POST  研究任务
/api/neon/*                   Neon Auth / AI Gateway
/api/subscription/*           订阅与计费
/api/wallet-auth              SIWE 钱包认证
/api/uniswap                  Uniswap 相关
```

---

## 相关仓库

- 官网：https://github.com/coolha-com/coolha.com
- 文档站：`docs.coolha.com`（仓库状态待核验）
- 项目总览与工程铁律：`docs/PROJECT_OVERVIEW.md`、`docs/ENTITLEMENT_ENFORCEMENT_STATUS.md`

---

> **诚实是本项目的第一原则。** 目录里写了什么不重要 —— **实际能跑什么才重要。** 未接入的条目就标未接入，宁可显得单薄，不可显得虚胖。
