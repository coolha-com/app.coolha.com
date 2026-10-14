# Coolha 算力市场 — Phase 0 项目审计报告

- **审计日期**：2026-10-14
- **审计对象**：`app.coolha.com`（仓库 `coolha-com/app.coolha.com`，分支 `agent`，HEAD `e8c03f5`，工作区干净）
- **审计方式**：只读代码审计 + 依赖实测（node_modules）+ 基线命令实测（lint / tsc / build / React 规范体检）
- **输入文档**：《Coolha 算力市场 PRD v0.1》、《技术架构修订说明（Vercel + AI SDK + AI Gateway 优先）》
- **审计范围**：只读审计，未修改任何业务代码

---

## 0. 结论摘要（TL;DR）

1. **项目具备承接算力市场 MVP 的完整基础**：Next.js 16.4 + React 19.3 + Tailwind 4 + shadcn 设计系统，品牌主色 `#c0e218` 已在设计令牌中，与 PRD 要求一致。
2. **AI SDK v7 与 Vercel AI Gateway 已实际在用**：`ai@7.0.138` 已装，现有 `/api/chat` 路由正以 `streamText({ model: "openai/gpt-5.5" })` 调用 AI Gateway；`.env.local` 中已存在 `AI_GATEWAY_API_KEY`。Phase 2「真实模型调用」的凭证与代码范式已具备，工作量显著低于 PRD 预估。
3. **两处 PRD 假设与实测不符，需按适配方案执行**：
   - PRD 假设「优先复用现有 Supabase」——**项目中没有任何数据库**（无 Supabase / Prisma / ORM 依赖），数据全部为静态 TS 文件。需在 Phase 3 前完成选型（建议 Vercel Marketplace 的 Neon Postgres）。
   - PRD 建议 `/compute/*` 路由——**现有 `/ai` 页面已是「算力市场」**（侧边栏标签、`/market` 入口卡、Dashboard 卡片三处均指向它，页面 h1 即「算力市场」）。按 PRD 自己的规则「应适配现有结构，不强行重构」，建议扩展 `/ai/*` 子路由。
4. **用户身份体系缺失但方向清晰**：当前仅有客户端钱包连接（Reown AppKit），无服务端会话、无 SIWE。算力市场的 API Key 必须绑定钱包地址，需要新增最小 SIWE 签名验证（Phase 2）。
5. **地理合规是硬约束**：`proxy.ts`（Next 16 中间件）对中国大陆等地区硬屏蔽，`/api/*` 返回 451。算力市场全部路由与 API 自动继承该约束；本地开发（中国大陆网络）需用 `__geoCountry` 参数覆盖。
6. **基线质量门禁全部实测通过**：lint 0 errors / 8 warnings（既有问题，与本次无关）；`tsc --noEmit` 0 errors；`npm run build` 全新构建成功（19 路由）；React 规范体检 76/100（B）。

---

## 1. 当前技术栈与版本（实测）

来源：`package.json` + `node_modules` 实测版本。

| 层    | 技术                                   | 实测版本                          | 备注                                                                 |
| ---- | ------------------------------------ | ----------------------------- | ------------------------------------------------------------------ |
| 框架   | Next.js                              | 16.4.0                        | App Router；`dev`/`build` 带 `--webpack`；中间件为 Next 16 新命名 `proxy.ts` |
| 运行时  | React / React DOM                    | 19.3.0                        | 函数组件 + RSC                                                         |
| 语言   | TypeScript                           | 5.9.3                         | `strict: true`；刻意未升 7.x（Go 重写版生态未验证）                               |
| 样式   | Tailwind CSS                         | 4.3.3                         | `@theme inline` 令牌；主色 `--primary: #c0e218`                         |
| 组件   | shadcn + @base-ui/react              | shadcn 4.21.4 / base-ui 1.9.0 | 已有 6 个 UI 组件（见 §2）                                                 |
| Web3 | Reown AppKit + wagmi + viem          | 1.8.24 / 3.7.7 / 2.57.5       | 网络：mainnet / sepolia / base / bsc，默认 sepolia                       |
| AI   | ai + @ai-sdk/react + @ai-sdk/gateway | 7.0.138 / 4.0.141 / 4.0.111   | **导出面已核实**（见 §5）                                                   |
| i18n | next-intl                            | 4.14.9                        | zh-Hans / zh-Hant / en 三语言                                         |
| 动效   | framer-motion                        | 14.2.0                        | 侧边栏 hover 动效                                                       |
| 主题   | next-themes                          | 0.4.6                         | 明/暗双主题                                                             |
| 监控   | @vercel/analytics + speed-insights   | 2.0.1 / 2.0.0                 | Vercel 部署的旁证                                                       |
| 查询   | @tanstack/react-query                | 5.104.2                       | 钱包数据查询                                                             |

**关键缺失项（实测不存在）**：数据库（无任何 DB 依赖）、测试框架（无 test 脚本）、认证/会话体系（无 SIWE / NextAuth）、`typecheck` 脚本（只有 `lint` / `dev` / `build` / `start`）。

---

## 2. 现有路由及组件结构（实测）

### 2.1 路由清单（本次构建实测输出）

```
/                     市场/落地页（动态）
/agent               智能体市场
/agent/role          智能体角色
/agent/task          智能体任务
/ai                  算力市场（现有空态占位页）
/api/chat            AI 聊天 API（streamText + AI Gateway）
/blocked             地区屏蔽页
/dashboard           仪表板
/market              市场入口聚合页
/rwa                 代币化市场
/settings            设置
/wallet              钱包
+ /robots.txt /sitemap.xml /apple-icon.png /twitter-image.png /_not-found
```

### 2.2 布局与组件结构

```
src/app/
├── layout.tsx                    根布局：NextIntlClientProvider > Theme > Wagmi_Provider
├── (APP)/
│   ├── layout.tsx                App 外壳：Sidebar + NavBar + children + NavFooter
│   ├── _layout/                  Sidebar（导航）/ NavBar / NavFooter / ButtonMenu（更多菜单）
│   ├── (dashboard)/dashboard/    仪表板
│   ├── (market)/market/          三大市场入口卡（算力/智能体/代币化）
│   ├── ai/  ← 算力市场现有页面（h1 即「算力市场」）
│   ├── agent/  rwa/  wallet/
├── settings/  blocked/
├── api/chat/route.ts
src/components/
├── ui/                           button / card / input / avatar / dropdown-menu / sheet（shadcn 风格）
├── web3/ConnectButton.tsx        Reown 连接按钮（ENS 名 + 像素头像）
├── ThemeSwap.tsx  LanguageSwitcher.tsx
src/config/                       Theme.tsx / Wagmi_Provider.tsx / wagmi.tsx
src/lib/                          utils.ts（cn）/ aifi-data.ts / compliance/geo.ts
src/i18n/                         request.ts + zh-Hans / zh-Hant / en.json
src/utils/                        AddressTruncate / formatNumber / formatDate 等
proxy.ts                          Next 16 中间件（地理合规，见 §7）
```

### 2.3 现有页面开发范式（算力市场 Phase 1 应遵循）

- 页面默认 **Server Component**，从 `src/lib/*.ts` 静态数据文件取数；
- 数据为空时渲染**明确的空态文案**（如「暂无已接入的真实算力资产。接入真实 API 与计量数据后将在此展示。」）——与 PRD「不得虚构数据」要求一致，是本项目的重要既有纪律；
- 卡片式布局：`rounded-2xl border bg-card p-5 shadow-sm`，图标容器 `bg-primary/15 text-primary`；
- 导航高亮：Sidebar 用 `pathname.startsWith()` 匹配；
- i18n：文案走 `useTranslations`，侧边栏 `sidebar.ai` 已存在且值为「算力市场」。

---

## 3. 认证和钱包连接方案（实测）

| 项          | 现状                                                                    |
| ---------- | --------------------------------------------------------------------- |
| 钱包连接       | Reown AppKit（`createAppKit`），wagmi 适配器，cookieStorage，SSR 关闭           |
| Project ID | `process.env.NEXT_PUBLIC_REOWN_ID \|\| REOWN_ID`，缺失时优雅降级（不初始化 AppKit） |
| 网络         | mainnet / sepolia / base / bsc（默认 sepolia）                            |
| 身份标识       | 仅客户端 `useAppKitAccount().address` + ENS 名/头像                          |
| 服务端会话      | **无**。没有 SIWE、没有登录态、没有用户表                                             |
| AppKit 配置  | themeMode 跟随主题，accent `#accf00`，`legalCheckbox: true`                 |

**对算力市场的影响**：API Key 必须绑定钱包地址。需新增最小 SIWE 流程（wagmi 签名 → 服务端 viem `verifyMessage` → 签发会话 Cookie → 再签发 API Key）。**钱包地址本身不能直接作为 API 密钥**（PRD 4.6 已明确）。这是 Phase 2 的新增工作量，无现成代码可复用。

---

## 4. Supabase 与数据库现状（实测）

**结论：项目中不存在任何数据库。**

- `package.json` 无 `@supabase/supabase-js`、无 Prisma/Drizzle、无任何 DB 驱动；
- 全部业务数据为静态 TS 文件：`src/lib/aifi-data.ts`（且 `aiAssets` / `agentServices` / `rwaAssets` / `subscriptionProducts` 等导出**均为空数组**，页面呈现空态）；
- `docs/COOLHA_PROJECT_MEMORY.md` 记载 Supabase 属于「历史技术栈」，当前仓库未见落地。

**决策 D2（需用户确认，阻塞 Phase 3）**：按《技术架构修订说明》第 7 条「先审计并复用现有 Supabase；如果尚无可用数据库，再评估 Vercel Marketplace 中的数据库服务」——

- **推荐：Vercel Marketplace → Neon Postgres**。理由：与「Vercel 优先」原则一致；算力账本需要事务型 SQL（幂等入账、NUMERIC 金额）；本项目无既有用户体系需要保留（钱包身份优先），不存在「重复建设用户体系」问题。
- 备选：新建独立 Supabase 项目（PRD 原始偏好，但引入第二家云服务商，且其 Auth 对钱包身份方案无增量价值）。
- 无迁移破坏风险（绿地项目）。

---

## 5. AI 能力现状（实测，重点）

| 项                 | 实测结果                                                                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai` 包            | 7.0.138，导出含 `streamText` / `generateText` / `gateway` / `createGateway` / `convertToModelMessages` / `createUIMessageStreamResponse` / `toUIMessageStream` / `tool` / `isStepCount` / `stepCountIs` |
| `@ai-sdk/react`   | 4.0.141，导出 `useChat` / `useCompletion` / `useObject` / `Chat`                                                                                                                                       |
| `@ai-sdk/gateway` | 4.0.111，导出 `gateway` / `createGateway` / `createGatewayProvider` / `GatewayError` 等错误类型                                                                                                             |
| 现有用法              | `src/app/api/chat/route.ts`：`streamText({ model: "openai/gpt-5.5", ... })` —— 字符串模型 ID 即 AI Gateway 默认 Provider 形态                                                                                  |
| 凭证                | `.env.local` 含 `AI_GATEWAY_API_KEY`（仅核实键名存在，**未读取值**；运行时有效性尚未验证，列为 Phase 2 首个验证点）                                                                                                                   |
| zod               | 4.6.7（major 升级已完成，`z.object` 用法兼容）                                                                                                                                                                  |

**结论**：PRD Phase 2「实现服务端 API 网关、Provider Adapter」中，「模型调用与流式输出」部分已有可复用范式；按技术修订说明，**不自建模型路由网关**，改为「AI SDK → AI Gateway」，Coolha 只开发用户 API Key、限额、账本三层（见决策 D3）。

**待验证风险**：`/api/chat` 中的模型 ID `openai/gpt-5.5` 是否为 AI Gateway 当前可用模型，需在 Phase 2 端到端测试时核实；若不可用需替换为目录中真实模型。

---

## 6. 环境变量与部署（实测）

### 6.1 环境变量（仅列键名，未读取值）

`.env.local` 现有键：`AI_GATEWAY_API_KEY`、`REOWN_ID`、`ALCHEMY_KEY`、`ALCHEMY_ID`。

- 安全核查通过：`.gitignore` 第 35 行 `.env*` 覆盖 `.env.local`；`git ls-files` 确认未被跟踪；全历史无提交记录。
- 注：`ALCHEMY_KEY` / `ALCHEMY_ID` 已配置但 `src/config/wagmi.tsx` 当前使用各链默认公共 RPC。

### 6.2 部署

- 仓库：`github.com/coolha-com/app.coolha.com`，当前分支 `agent`（非 main）；
- 本地无 `.vercel` 目录（未经 `vercel link`）；结合 `@vercel/analytics` 依赖，**推测为 Vercel Git 集成自动部署**，需在 Vercel 后台确认生产分支与域名映射（列入待确认）；
- `metadataBase: https://app.coolha.com`，Analytics/SpeedInsights 已接线。

### 6.3 基线检查结果（本次会话实测）

| 检查         | 命令                        | 结果                                                                                                                                                                                                                                                      |
| ---------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lint       | `npm run lint`            | **0 errors，8 warnings**（均为既有未使用 import：dashboard/page.tsx ×4、Sidebar.tsx ×2、ai/page.tsx ×2；Phase 1 改写这些页面时自然消解）                                                                                                                                         |
| 类型检查       | `npx tsc --noEmit`        | **0 errors**                                                                                                                                                                                                                                            |
| 构建         | `npm run build`           | **✓ 成功**（76s 编译，19 路由全量生成；本次为重命名 `.next` 后的全新构建）                                                                                                                                                                                                        |
| React 规范体检 | react_engine.py audit src | **76/100，B 级**；4 个 WARN：① 1 处 `any`；② 根 layout 缺 metadata（**疑似误报**——`layout.tsx` 实际已导出 `generateMetadata`，启发式扫描未识别异步函数形式）；③ 缺 `error.tsx` / `not-found.tsx` 错误边界（**真实缺失**，建议 Phase 1 补）；④ `/api/chat` 未设 Cache-Control（流式接口本不应缓存，但模型目录类接口应设，Phase 2 处理） |
| 密钥安全       | git 核查                    | `.env.local` 从未入库 ✓                                                                                                                                                                                                                                     |

> 环境备注：本环境的批量删除保护会拦截 `next build` 对 `.next`（>50 文件）的清理。本次通过「先重命名 `.next` 再构建」的非破坏性方式完成验证；遗留 `.next.old`（约 899MB 旧缓存）待用户确认后清理。后续阶段每次构建前都需如此处理，或由用户在本机执行。

---

## 7. 地理合规约束（实测，对算力市场为硬约束）

`proxy.ts`（Next 16 中间件，匹配除静态资源外全部路径）：

- **硬屏蔽**（页面 307 跳转 `/blocked`，`/api/*` 返回 451）：IR / KP / MM / CU / RU / BY / SY / **CN**（默认清单，可用 `GEO_HARD_BLOCKED_COUNTRIES` 覆盖）；
- **软网关**：HK / SG / GB / US 等（仅打标，不拦截）；
- 向请求注入 `x-coolha-geo-country` / `x-coolha-geo-access-tier` 响应头，Route Handler 可读取。

**影响**：

1. 算力市场所有页面与 `/api/v1/*` 自动继承屏蔽——**产品定位即面向海外开发者**，与中国大陆用户之间存在既有产品级隔离，无需为算力市场单独造机制；
2. 本地开发在中国大陆网络下会被硬屏蔽，需访问 `/?__geoCountry=US` 类参数覆盖（仅 `NODE_ENV !== production` 生效）；
3. Playground 与网关错误处理需把 451 / 地区信息转换为可读错误（PRD 4.3 要求）。

---

## 8. 对 PRD 的关键修正与决策点

### 决策 D1：路由策略——扩展 `/ai/*`，不新建 `/compute/*`（需确认）

实测 `/ai` 已是「算力市场」：侧边栏 `sidebar.ai = 算力市场` → `/ai`；`/market` 入口卡「算力市场」→ `/ai`；Dashboard「算力市场」卡片 → `/ai`；页面 h1「算力市场」。PRD 第 3 节明确「路由应遵循现有项目的实际目录结构……应适配，而不是强行重构」。

**建议路由映射**：

| PRD 路由                 | 实际采用                                                        | 说明           |
| ---------------------- | ----------------------------------------------------------- | ------------ |
| `/compute`             | `/ai`（升级现有页面）                                               | 市场首页         |
| `/compute/models`      | `/ai/models`                                                | 模型广场         |
| `/compute/models/[id]` | `/ai/models/[id]`                                           | 模型详情         |
| `/compute/playground`  | `/ai/playground`                                            | 在线测试         |
| `/compute/api-keys`    | `/ai/api-keys`                                              | 密钥管理         |
| `/compute/usage`       | `/ai/usage`                                                 | 用量记录         |
| `/compute/billing`     | `/ai/billing`                                               | 余额与账单        |
| `/compute/providers`   | 后置                                                          | 供应商目录（可选公开页） |
| `/admin/compute`       | 后置                                                          | 管理后台         |
| API                    | `/api/v1/chat/completions`、`/api/v1/models`、`/api/v1/usage` | 与 PRD 一致，无冲突 |

### 决策 D2：数据库选型（见 §4，阻塞 Phase 3，建议 Neon Postgres）

### 决策 D3：网关范围——按技术修订说明收缩自建范围

| 能力             | 归属                     | 实现                          |
| -------------- | ---------------------- | --------------------------- |
| 模型调用 / 流式 / 工具 | AI SDK（`streamText` 等） | 业务代码少量封装                    |
| 上游接入与路由        | Vercel AI Gateway      | 零自建                         |
| 上游成本观测         | AI Gateway             | 读取 usage / providerMetadata |
| 用户 API Key     | **Coolha 自建**          | 哈希存储、单次展示、限额                |
| 用户余额 / 订单 / 限额 | **Coolha 自建**          | DB + 服务端逻辑                  |
| 稳定币充值 / 链上验证   | **Coolha 自建（Phase 4）** | viem + 现有 EVM 网络            |

三类数据（Vercel 上游费用 / Coolha 用户收费 / Coolha 账本）分别管理、可对账。

### 决策 D4：身份与 API Key 绑定（Phase 2 新增最小 SIWE）

钱包签名 → 服务端 `verifyMessage` → 会话 Cookie → 签发 `coolha_` 前缀 API Key（安全随机 + SHA-256 哈希入库，仅创建时展示全量）。

### 决策 D5：品牌与设计系统

`#c0e218` 主色、暗色主题、圆角体系、卡片范式均已就绪，**无需为新模块改全局设计**；Playground 等重交互组件按「Server Component 优先 + 交互叶子客户端化」原则落地。

### 决策 D6：测试策略

不引入测试框架（避免 Phase 1 负担）。质量门禁 = `lint` + `tsc --noEmit` + `build` + 每阶段手动测试清单；Phase 3 起对账本幂等、限额拦截等资金逻辑补充针对性测试。

---

## 9. 文件影响清单


### 9.1 复用（不改或极少改）

- `src/components/ui/*`（button/card/input/avatar/dropdown-menu/sheet）、`src/lib/utils.ts`（cn）
- `src/app/(APP)/_layout/*`（Sidebar/NavBar/NavFooter/ButtonMenu）、`src/app/layout.tsx`、`(APP)/layout.tsx`
- `src/config/*`（Theme/Wagmi_Provider/wagmi）、`src/components/web3/ConnectButton.tsx`
- `proxy.ts` + `src/lib/compliance/geo.ts`（地理合规）
- `src/i18n/*`（三语言文件追加 compute 命名空间）
- Tailwind 设计令牌（globals.css）

### 9.2 新增（按阶段）

**Phase 1（前端 MVP，Mock 明确标记）**

```
src/lib/compute/types.ts               ComputeModel/Provider/UsageRecord 等类型 + dataSource 标记
src/lib/compute/catalog.ts             Mock 模型目录（每条带 dataSource:'mock'）
src/lib/compute/service.ts             查询/筛选/排序/成本估算纯函数（UI 不直连数据）
src/components/compute/                ModelCard / FilterBar / StatusBadge / PriceTag / MockBadge / ComputeSubNav
src/app/(APP)/ai/models/page.tsx       模型广场
src/app/(APP)/ai/models/[id]/page.tsx  模型详情 + 成本估算器
src/app/(APP)/ai/playground/page.tsx   Playground（客户端交互叶子 + 服务端 Mock 路由）
src/app/(APP)/ai/api-keys/page.tsx     密钥管理（Phase 1 为 UI 壳，Phase 2 接后端）
src/app/(APP)/ai/usage/page.tsx        用量记录（UI 壳）
src/app/(APP)/ai/billing/page.tsx      余额与账单（UI 壳）
src/app/api/compute/playground/route.ts  Mock Provider 流式路由（Phase 2 替换为真实网关）
```

**Phase 2（真实调用与密钥）**

```
src/app/api/v1/chat/completions/route.ts   OpenAI 兼容网关（streamText + gateway）
src/app/api/v1/models/route.ts             模型目录 API
src/app/api/v1/usage/route.ts              用量查询 API
src/lib/compute/gateway.ts                 AI SDK 封装（模型 ID 映射、超时、错误转换）
src/lib/compute/api-keys.ts                生成/哈希/校验
src/lib/compute/auth.ts                    最小 SIWE 验证 + 会话
src/lib/compute/usage.ts                   用量解析与成本核算（onFinish）
```

**Phase 3（计费与数据库，D2 定案后）**

```
db/migrations/*（或 supabase/migrations/*）  compute_providers / compute_models / compute_api_keys /
                                             compute_requests / compute_ledger / compute_orders /
                                             compute_price_versions / compute_favorites
src/lib/compute/ledger.ts                   幂等账本（NUMERIC、反向流水纠错）
src/lib/compute/rate-limit.ts               限额与拦截（优先平台能力，不自建 Redis）
```

**Phase 4（稳定币支付）**：订单生命周期、tx hash、服务端链上验证（viem）、幂等入账、退款与异常单处理。

### 9.3 修改

- `src/app/(APP)/ai/page.tsx` — 升级为算力市场首页（保留空态纪律，接 catalog service）
- `src/app/(APP)/_layout/Sidebar.tsx` — 仅在需要子入口徽标/分组时微调（`/ai` 入口已存在，默认不改）
- `src/i18n/zh-Hans.json` / `zh-Hant.json` / `en.json` — 新增 `compute` 文案命名空间
- `src/lib/aifi-data.ts` — 保持不动（agent/rwa 页仍在用）；算力数据迁入 `src/lib/compute/catalog.ts`

---

## 10. 分阶段实施计划

### Phase 1：前端 MVP（Mock，全部明确标记）

- **目标**：`/ai/*` 六个页面可访问、响应式、交互可用、Mock 数据 100% 带「示例数据」标识；`tsc` / `lint` / `build` 通过。
- **范围**：模型广场（搜索/筛选/排序/收藏交互）、模型详情（能力/价格/上下文/成本估算器）、Playground（Mock 流式、停止/清空/重新生成、耗时与 Token 展示、Request ID、错误可读化、复制示例）、API Keys / Usage / Billing 三个 UI 壳页。
- **架构纪律**（vercel-react-best-practices）：页面 Server Component；`'use client'` 仅下推到交互叶子；补 `error.tsx` / `not-found.tsx`；数据一律经 `src/lib/compute/service.ts`，禁止组件内硬编码模型数组；模型目录 API 预留 Cache-Control。
- **验收**：PRD §7 中属本阶段的条目（页面读取后台/文件配置而非硬编码、真实与 Mock 有标识、现有路由与钱包连接未被破坏）。
- **不验证真实计费**，不展示虚假充值状态。

### Phase 2：真实模型调用与 API Key

- 实现 `/api/v1/*` 三接口；`streamText` + AI Gateway；非流式/流式；超时、体积限制、限流、错误转换；Request ID 全链路；
- **首个验证点**：用现有 `AI_GATEWAY_API_KEY` 跑通端到端真实调用，并核实 `openai/gpt-5.5` 可用性；
- API Key 生命周期 + SIWE 绑定；用量解析优先采信上游 usage/providerMetadata；
- 验收：PRD §7 网关与密钥相关全部条目；未配置真实供应商时不得伪装调用成功。

### Phase 3：计费与数据库（D2 定案后启动）

- Migration 落地 8 张表；用户数据隔离（RLS 或等效服务端控制）；账本幂等（唯一业务 ID、反向流水纠错）；限额与余额不足拦截；
- **不启用真实扣费**直至测试通过；Mock 充值订单可演示。

### Phase 4：稳定币支付（条件成熟后）

- 订单 → 链上验证（网络/币种/地址/金额/确认数）→ 幂等入账；防重放、防错网络、防未足额、订单过期；
- 前置条件：支付方案、供应商授权、资金流程与合规要求经过验证（PRD §4.7 的资金/监管提示必须向用户明示）。

---

## 11. 主要风险与未解决问题

| #  | 风险/问题                                                             | 等级 | 处置                                  |
| -- | ----------------------------------------------------------------- | -- | ----------------------------------- |
| R1 | `AI_GATEWAY_API_KEY` 运行时有效性未验证；`openai/gpt-5.5` 可用性未验证            | 高  | Phase 2 首个端到端测试                     |
| R2 | 数据库选型未定（D2），阻塞 Phase 3                                            | 高  | 需用户确认 Neon / Supabase               |
| R3 | 无测试框架，资金逻辑（账本/幂等/限额）缺自动化保障                                        | 中  | Phase 3 前补针对性测试；每阶段手动清单             |
| R4 | 本环境批量删除保护导致 `next build` 需先重命名 `.next`；遗留 `.next.old`（约 899MB）待清理 | 中  | 已用非破坏性方式完成本次构建；`.next.old` 待用户确认后删除 |
| R5 | Vercel 项目绑定/生产分支未在本地确认（无 `.vercel`，当前 Git 分支为 `agent`）            | 中  | 用户在 Vercel 后台确认                     |
| R6 | 供应商商业授权、转售权、地域与数据条款需逐家核实（PRD 4.5）                                 | 中  | 法务尽调，先接一家                           |
| R7 | `/api/chat` 现有公开端点无鉴权无限流——算力市场不得复刻该模式；是否收窄该端点另行评估                 | 低  | Phase 2 一并评估                        |
| R8 | CN 硬屏蔽意味着产品面向海外；若目标用户含中国大陆，需产品层明确定位                               | 低  | 产品决策                                |
| R9 | Playground/网关对 451 地区错误的可读化处理                                     | 低  | Phase 1 错误设计覆盖                      |

---

## 12. 所需环境变量（名称清单，不含值）

| 阶段      | 变量                                     | 状态                  |
| ------- | -------------------------------------- | ------------------- |
| 现有      | `AI_GATEWAY_API_KEY`                   | 已存在（值未验证）           |
| 现有      | `REOWN_ID` / `NEXT_PUBLIC_REOWN_ID`    | 已存在                 |
| 现有      | `ALCHEMY_KEY` / `ALCHEMY_ID`           | 已存在（当前未用于 wagmi 传输） |
| Phase 2 | `COMPUTE_MOCK_MODE`（可选，Mock/真实切换）      | 新增                  |
| Phase 3 | `DATABASE_URL`（及 `DIRECT_URL`，依 D2 定案） | 新增                  |
| Phase 4 | 支付/链配置（网络、收款地址、确认数策略）                  | 新增                  |

---

## 13. 下一步

本报告完成后，等待用户确认 **D1（路由扩展 /ai/*）、D2（数据库选型）** 两个决策点，即可进入 **Phase 1 前端 MVP** 实施。Phase 1 完成后按 PRD 交付要求汇报：变更文件清单、验证结果、遗留问题、手动测试步骤。
