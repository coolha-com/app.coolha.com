# Web3 Tool Registry — 阶段一实施方案（待评审）

> ## ⚠️ 2026-10-16 决策变更：不自研工具，直接接现成的
>
> **本文档 §3/§5 的「9 个自研工具」方案已作废。** 决定改为：
> **不自研工具层，直接接入市场上已有的 MCP Server / Agent Skill。**
>
> 理由：行业已收敛出 **MCP + Agent Skills** 两个标准，
> 与其平行造一套轮子，不如站在标准上。我们的增量投入放在
> **治理层（模拟 / 风险扫描 / 限额 / 签名流）、证据卡与用户主权**上，
> 而不是重写数据源。
>
> **仍然有效的部分**（可继续照做）：
> - §2 数据流与接线方式（工具挂到 `/api/compute/playground` 的 `streamText`）
> - §4 **证据信封契约**（数据源/方法/链/时间/覆盖范围/未知项 + 四条反幻觉硬规则）——
>   接第三方工具时这层封装**更重要**，因为我们对上游返回值的控制更少
> - §6 Registry 注册中心结构（把第三方 MCP 包成统一 ToolDefinition）
> - §7 计量与限额、§8 降级策略、§9 证据卡 UI、§11 验证方案
>
> **需要重做的部分**：§3 文件清单、§5 九个工具契约 → 改为「接入 P0 五件套」：
> `Tenderly MCP`（模拟）、`Alchemy MCP`（链数据）、`Slither MCP`（合约分析）、
> `DefiLlama Skills`（DeFi 数据）、`request-wallet-sign`（签名流范式）。
> 完整选型与逐条取舍见 `src/lib/web3-tools/catalog.ts` 与 `/ai/tools` 页面。

---

- **日期**：2026-10-16
- **状态**：⏸ 待评审后再动代码
- **上游文档**：`docs/WEB3_AI_WORKBENCH_PRD.md`（产品定位与路线图）
- **目标**：在现有 AI 推理链路中加入可靠的 Web3 工具层，先落地**真实、可追溯的只读链上查询**，把 `/chat` 从通用聊天升级为 Web3 AI 工作台的第一块地基

---

## 0. 范围

**做：**

- 一个 Web3 工具层（服务端），**包装现成的第三方 MCP / Skill**
- 接入现有 `/api/compute/playground` 推理链路，LLM 自主决定是否调用
- 每个工具返回值都带**证据信封**：数据源、方法、链、时间、延迟、覆盖范围、明确的「未知项」
- 工具调用预算、每日计量、相同参数去重
- 聊天界面展示工具状态与证据卡（含区块浏览器链接）
- 调试端点 + 回归脚本，验证「是真的查了链而不是编的」

**不做（阶段一）：**

- 不做任何写操作／交易构造／签名（只在兜底消息里说明尚未支持）
- 不动 BYOK 推理链路（浏览器直连，工具调用需单独设计，见 §12）
- 不做 Agent 授权、x402、MCP 对外开放（Phase 3/4）

---

## 1. 已核实的代码事实（接线点）

以下均来自本地代码实测，不是假设：

| 事实                                                                                                         | 依据                                            |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 推理入口是单路由 `/api/compute/playground`，`streamText()` 无 `tools` 配置                                             | `src/app/api/compute/playground/route.ts:229` |
| 已有多层门禁：geo 451 → Gateway key 503 → 熔断开关 → IP 限流 → **匿名 401** → 模型存在性 → `isSponsorableModel` 403 → 额度 429   | route.ts 全文                                   |
| 少一步 Ideally：缺「模型是否支持工具调用」的判断                                                                               | 待新增                                           |
| 已有 SIWE 会话 `getWalletSessionFromCookies()`，会话里有钱包地址                                                        | route.ts:126                                  |
| 已有 `subject`（业务主键 users.id::text）                                                                          | `resolveSubject()`                            |
| 已有 `usage_daily(subject, day, requests, input_tokens, output_tokens)` 护卫科学与 discharges UPDATED ON CONFLICT | `src/lib/neon/quota.ts:143`                   |
| 已有 Alchemy 凭证读取约定：`ALCHEMY_KEY` 或 `ALCHEMY_ID`                                                             | `src/lib/subscription/scan.ts:34`             |
| viem 2.57 / zod 4.6 / ai 7.0.138 已装；`tool`、`stepCountIs`、`hasToolCall` 已导出                                 | package.json + node 实测                        |
| 客户端 `useChat` + `DefaultChatTransport`，渲染时**只取 text/reasoning 两个 part**，工具 part 会被静默丢弃                     | `PlaygroundChat.tsx:741`                      |
| BYOK 是浏览器直连 `streamCustomModel()`，不经服务端                                                                    | `src/lib/compute/byok-client.ts`              |
| 迁移已到 009                                                                                                   | `db/migrations/`                              |

---

## 2. 架构与数据流

```
用户提问 → /api/compute/playground
            ├─ 既有门禁（geo / key / 熔断 / 限流 / 401 / 模型校验 / 403 / 429）【不改】
            ├─ 新增：渠道可用性判定 → 构建 ToolSet + 注入 system 规则
            ▼
        streamText({ model, system, messages, tools, stopWhen: stepCountIs(N) })
            ├─ 模型决定调工具 → registry 执行（预算 / 去重 / 超时 / 证据封装）
            │       └─ 真实数据源：Alchemy RPC / Alchemy 增强 API / DefiLlama / Etherscan
            ├─ 工具结果回流给模型，模型据此作答
            └─ UI 消息流天生携带 tool-* parts → 前端渲染证据卡
```

关键原则：**LLM 负责决定要什么数据并解释结果；程序负责取数、校验参数、记录来源。** 模型不拥有数据源，也不被允许替数据源说话。

---

## 3. 文件清单（全部新增，不动现有文件除以下三处：playground/route.ts、PlaygroundChat.tsx、quota.ts）

```
src/lib/web3/
├── chains.ts        # 网络登记：RPC 子域、浏览器地址、平均出块时间、启用开关
├── clients.ts       # viem 公共客户端缓存 + Alchemy 增强 API 直调 + 超时/错误归一
├── evidence.ts      # ToolResult 证据信封 + 浏览器链接 + 错误分类 + trace() 包装器
├── schemas.ts       # Zod v4 参数校验（地址/链/哈希/限额）
├── utils.ts         # 时间→区块估算、金额格式化、地址裁剪、大对象裁剪
├── tools/
│   ├── balance.ts       # get_native_balance, get_token_balances
│   ├── transactions.ts  # get_transaction_history, get_transaction_details
│   ├── contract.ts      # read_contract
│   ├── decode.ts        # decode_transaction
│   ├── gas.ts           # get_gas_price
│   ├── protocol.ts      # get_protocol_data
│   └── source.ts        # analyze_contract_source
└── registry.ts      # 工具注册中心：元数据、可用性、预算、去重、AI SDK ToolSet 构建

src/lib/ai/web3-prompts.ts                 # 工具使用与反幻觉系统规则
src/components/compute/ToolEvidenceCard.tsx # 聊天中的证据卡
src/app/api/web3/tools/route.ts            # 调试/验证端点（GET 清单 / POST 直调）
scripts/verify-web3-tools.mjs              # 回归脚本
db/migrations/010_web3_tool_calls.sql      # usage_daily 新增 web3_calls 列
```

---

## 4. 证据信封（本次升级的核心契约）

```ts
export interface ToolResult<T> {
  ok: boolean
  tool: string
  source: {
    provider: "alchemy-rpc" | "alchemy-index" | "defillama" | "selector-registry" | "explorer"
    method: string          // eth_getBalance / alchemy_getAssetTransfers ...
    endpoint: string        // 端点标识，**不含密钥**
    chain: Web3ChainKey
    chainId: number
    fetchedAt: string       // ISO
    latencyMs: number
  }
  data: T | null
  warnings: string[]        // 数据覆盖局限：截断、估算、缺失
  unknown: string[]         // 明确「没查到/无法确认」的项 —— 模型不得补齐
  coverage?: {              // 覆盖范围，模型必须照此声明
    fromBlock?: number|string; toBlock?: number|string
    from?: string; to?: string
    requestedWindow?: string; truncated?: boolean; returnedItems?: number; note?: string
  }
  error?: { code: string; message: string; retryable?: boolean }
}
```

四条硬规则（写进 system prompt，也让 lint/review 有据可依）：

1. **先取数再断言**：没有工具结果支撑的结论不得输出。
2. **每条关键结论必须可溯源**：尽量关联交易哈希 / 区块高度 / 时间 / 链 / 数据源，并给出浏览器链接。
3. **没查到就说没查到**：不允许用常识或预训练记忆补齐链上事实（余额、交易、合约状态）。
4. **声明覆盖边界**：返回被截断的数据或估算得出的区块时，必须照实说出来。

配套：`trace()` 包装器统一处理计时、异常捕获、错误码归一（`UPSTREAM_TIMEOUT` / `UPSTREAM_RATE_LIMIT` / `UPSTREAM_AUTH` / `UPSTREAM_ERROR`），保证**单个工具失败不会中断整条推理**，模型拿到的是结构化失败而不是异常堆栈。

---

## 5. 九个工具契约

| 工具                        | 入参                                            | 数据源                                                     | 返回要点                                                       | 失败语义                                                                |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| `get_native_balance`      | address, chain                                | RPC `eth_getBalance`                                    | 原生币余额（wei + 可读值）、区块高度、地址链接                                 | 无 key → 工具不注册（非错误信息）                                                |
| `get_token_balances`      | address, chain, maxResults                    | `alchemy_getTokenBalances` + token 元数据                  | 非零 ERC-20 持仓（符号、精度、数量）                                     | 元数据查不到的 token 进 `unknown`，不猜符号                                      |
| `get_transaction_history` | address, chain, days?, direction?, maxResults | `alchemy_getAssetTransfers`（external/erc20/erc721，双向各取） | 转账列表（时间/区块/方向/资产/数量/tx 链接）+ 对手方与分类汇总                       | **普通 RPC 查不到地址历史**，必须用索引 API；时间窗用平均出块时间加密钥估算并一次校正，在 coverage 里标注为估算 |
| `get_transaction_details` | txHash, chain                                 | RPC tx + receipt + block                                | status、gasUsed、有效 gasPrice、时间戳、日志条数、调用 Method ID、浏览器链接     | tx 不存在 → `ok:false` + `NOT_FOUND`，禁止推断内容                            |
| `read_contract`           | address, method, args?, abiSignatures?, chain | RPC `eth_call`                                          | 返回值 + 使用的 ABI 来源（内置标准 ABI / 调用方提供的人可读签名）                   | 无 ABI 且非内置方法 → 明确拒绝，不猜实现                                            |
| `decode_transaction`      | txHash, chain                                 | RPC + 内置选择器表 + 可选 4byte 查表                              | 函数签名（或 unknown）、解码参数、代币转账明细（含 decimals 解析，解析失败标 unknown）   | 无法识别的方法一律标 `unknown`，选择器查表结果标注为**启发式**                              |
| `get_gas_price`           | chain                                         | RPC `eth_gasPrice` + `estimateFeesPerGas`               | 当前 gas、EIP-1559 建议值、普通转账/ERC-20 转账的估算费用                    | 网络拥堵时仍返回真实值，附 `拥堵` warnings                                         |
| `get_protocol_data`       | protocol? / mode=chains                       | DefiLlama 公开 API（无 key）                                 | 协议 TVL、分类、分链分布（裁剪前 8）、是否审计；mode=chains 返回链 TVL 排行          | 超时 8s 即失败，明确 `DEFILLAMA_UNAVAILABLE`                                |
| `analyze_contract_source` | address, chain                                | Etherscan V2（需 `EXPLORER_API_KEY`）                      | 是否已验证、合约名、编译器、代理实现、License、源码片段（裁剪）、**启发式风险提示**（明确写明不等于审计） | 未配 key → 明确告知「源码数据源不可用，不要推断实现」                                      |

设计取舍：**宁可返回一个诚实的失败，也不要让模型在缺数据时自行补齐。**

---

## 6. Registry（可演进的注册中心）

```ts
export interface ToolDefinition {
  name: string
  description: string
  category: "read" | "research" | "protocol" | "contract"
  risk: "read-only"
  inputSchema: ZodType
  availability: () => { ok: true } | { ok: false; reason: string }   // 缺数据源即整工具不注册
  handler: (args, ctx: ToolContext) => Promise<ToolResult>
}

buildToolSet(ctx) → {
  tools: ToolSet,                       // AI SDK tool() 包装后的产物
  active: string[],                     // 本请求实际挂载的工具
  unavailable: { name: string; reason: string }[]  // 写进 system，让模型知道「不是它不想查」
}
```

内置四道护栏：

1. **预算**：单次请求最多 N 次工具调用（默认 12），超出返回结构化 `TOOL_BUDGET_EXCEEDED`，不静默放行
2. **去重**：同一请求内相同工具 + 相同参数命中缓存直接复用，标注「本次对话缓存」，防模型打转
3. **可用性降级**：缺 Alchemy key 时不注册链上工具，并在 system 里说明原因——避免模型浪费轮次，也避免编数据
4. **失败兜底**：任何异常都转 `ToolResult`，且 `warnings/unknown` 强制模型如实表达

后续新增工具只需加一个文件 + 一行注册，不用改聊天系统。

---

## 7. 计量与限额

- 迁移 `010`：`usage_daily` 增加 `web3_calls INTEGER NOT NULL DEFAULT 0`
- `quota.ts` 增加 `readTodayWeb3Calls(subject)` 与 `consumeWeb3Calls(subject, n)`
- 每日工具调用上限**对所有档位相同**（延续「按 token 数分档 = 违规」的项目红线），默认 60 次/日，环境变量可调
- 单次请求上限 12 次
- DB 不可用沿用既有 fail-open 哲学（记日志后放行），真正熔断靠 `WEB3_TOOLS_ENABLED=0`

---

## 8. 路由接线方式（改动最小）

只在现有 `streamText` 调用上增量加三处，**既有门禁一行不动**：

```ts
const web3 = await buildWeb3Tools({ requestId, subject, walletAddress })   // 新增
result = streamText({
  model: gateway(model.modelId),
  system: buildSystemPrompt(web3.unavailable),                            // 新增
  messages: await convertToModelMessages(...),
  ...(Object.keys(web3.tools).length ? { tools: web3.tools } : {}),       // 新增
  stopWhen: stepCountIs(MAX_STEPS),                                       // 新增：防无限 tool loop
  providerOptions: { gateway: { disallowPromptTraining: true } },          // 既有
})
```

降级策略：若上游报「该模型不支持 tools / function calling」，**自动去掉 tools 重试一次**（沿用现有 `disallowPromptTraining` 降级重试的既有模式），并在 meta 里标注 `web3Tools: false`。流结束后：`consumeWeb3Calls(subject, count)` 记账。

BYOK 路径（浏览器直连）阶段一**不挂工具**，UI 上说明「自带模型通道暂不支持链上工具」——这条会在 §12 里给出后续方案。

---

## 9. 前端展示

- 新增 `ToolEvidenceCard`：展示工具名、调用状态（执行中/完成/失败）、简明入参、数据源 + 方法 + 链 + 延迟、**区块浏览器链接**、warnings 与 unknown 徽标
- `PlaygroundChat` 的 `Bubble` 从「只拼 text」改为**按 parts 顺序渲染**（text / reasoning / tool-*），保持既有视觉风格不变
- 本地会话持久化不改结构，直接存 UIMessage（工具 part 本身可序列化）

---

## 10. 环境变量与迁移

| 变量                                | 默认                    | 用途                |
| --------------------------------- | --------------------- | ----------------- |
| `WEB3_TOOLS_ENABLED`              | 1                     | 一键关闭工具层           |
| `WEB3_TOOL_CHAINS`                | ethereum,base,sepolia | 启用网络              |
| `WEB3_RPC_TIMEOUT_MS`             | 12000                 | 单次 RPC 超时         |
| `WEB3_MAX_TOOL_CALLS_PER_REQUEST` | 12                    | 单次请求预算            |
| `WEB3_DAILY_TOOL_CALLS`           | 60                    | 每日工具调用上限（全档位一致）   |
| `WEB3_MAX_STEPS`                  | 6                     | 最大 tool loop 步数   |
| `EXPLORER_API_KEY`                | 无                     | 合约源码分析（缺失则该工具不注册） |
| `ALCHEMY_KEY`                     | 已配                    | 复用现有凭证            |

Vercel env 同步注意事项沿用既有纪律（`--type config` 便于复核、多环境分别加、禁管道写值防 BOM）。

---

## 11. 验证方案

`scripts/verify-web3-tools.mjs`（复用 `siwe-smoke.mjs` 的 SIWE 登录流程）：

1. `GET /api/web3/tools` 未登录 → 401
2. 登录后 → 返回工具清单与可用性
3. 逐个 `POST /api/web3/tools` 调用真实参数（ETH 余额 / Vitalik 地址 ETH + ERC-20 持仓 / 近 30 天历史 / 一笔真实 tx 详情与解码 / gas / DefiLlama TVL / 未配源码 key 时的诚实失败）
4. 断言：每次返回都含 `source.provider/method/fetchedAt`、`ok` 为真或带明确 error code、金额与时间可复核对得上
5. 断言预算与去重生效（同参数二次调用返回缓存标记）
6. 质量门禁：`npm run lint` + `npx tsc --noEmit` + `rm -rf .next && npm run build`（沿用「不得在开发服务器运行时清 .next」的既有教训）

---

## 12. 三个必须在阶段一解决的边界问题

1. **模型是否支持工具调用**：现有模型目录没有 `supportsTools` 标记。方案一：目录里增加能力标记（改动面大）；方案二（本次采用）：运行时错误嗅探 + 自动降级重试。**建议**后续把 `tool-use` tag 落进 model catalog UI 提示。
2. **BYOK 不做工具直连**：用户 key 在浏览器，用户的链上数据不能在服务端那套身份下查。后续可选方案：① 由服务端提供「链上查询 API」供客户端 BYOK 侧调用（工具执行仍在服务端，走同一套限额与隐私规则）；② 让 BYOK 用户可选把请求代理回服务端（与「密钥不出浏览器」冲突，需单独的产品决策）。**阶段一：BYOK 不支持工具，明确告知。**
3. **SIWE ≠ 授权**：已登录会话只能用于只读查询的默认钱包上下文；任何钱包资产查询都必须在提示里明确「这是你连接的钱包」。写操作必须有独立签名流程，阶段一不触碰。

---

## 13. 实施步骤（每步可暂停 review）


| # | 步骤 | 产出 | 是否引入行为变化 |
| --- | --- | --- | --- |
| 1 | chains + clients + schemas + evidence + utils | `src/lib/web3/*` 基础层 | 无（无人引用） |
| 2 | 九个工具实现 | `src/lib/web3/tools/*` | 无 |
| 3 | registry + prompts | `registry.ts`、`web3-prompts.ts` | 无 |
| 4 | 调试端点 `/api/web3/tools` | 可独立验证的工具入口 | 新增端点（需登录） |
| 5 | 迁移 010 + quota 扩展 | `usage_daily.web3_calls` | 表结构新增一列 |
| 6 | **接线 playground**（关键一步） | route.ts 增量改造 | **是**：Chat 开始具备工具能力 |
| 7 | 证据卡 UI | `ToolEvidenceCard.tsx` + Bubble 改造 | 是：界面新增工具区块 |
| 8 | 验证脚本 + 质量门禁 | `scripts/verify-web3-tools.mjs` | 无 |

建议 review 暂停点：**步骤 3 完成后**（看工具契约和证据规范是否认同）与 **步骤 6 之前**（确认接线方式无误）。

---

## 14. 风险与取舍

| 风险 | 取舍 |
| --- | --- |
| Alchemy 免费额度被工具调用打穿 | 单次 12 次 + 每日 60 次硬顶；同参数去重；后期可接付费层或自建索引 |
| 工具返回撑爆上下文 | 各工具默认返回条数上限 + 源码/ DefiLlama 响应裁剪 + coverage 标注截断 |
| 模型反复调用工具 | `stopWhen` 步数上限 + 预算 + 去重三件套 |
| 平均出块时间估算不准 | 一次真实区块时间戳校正，并在 coverage 里公开为估算值，不装作精确 |
| Etherscan 缺 key | 该工具直接不注册（诚实降级），而不是返回似是而非的分析 |
| 4byte/DefiLlama 第三方可用性 | 短线超时 + 明确标注为启发式/第三方数据，失败即 fail fast |
