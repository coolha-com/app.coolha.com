# DeFAI DApp 技术方案

## 一、文档目标

本方案不再假设 Coolha 已经具备完整的 AI 中台、DeFi 路由层和后端服务，而是基于当前仓库的真实状态，重新定义一条更贴近现状的实施路径：

- 以现有 `Next.js 16 + React 19 + TypeScript + Tailwind CSS` 为前端核心
- 以现有 `wagmi v3 + viem + @reown/appkit` 为链上连接和钱包交互基础
- 以 **Base 优先、USDC 优先、EVM 兼容** 为产品和技术主线
- 以 **DeFAI = 链下推理 + 链上执行 + 用户签名确认** 为交互原则
- 以“先做可用的 Base/USDC 工作流，再逐步加 AI 和 Agent 能力”为落地策略


## 二、当前项目现状

### 2.1 当前仓库已具备的能力

从当前代码结构看，项目更接近一个已经搭好壳层的 Web3 前端应用，而不是已经完成链上策略层的 DeFAI 系统。

| 模块 | 当前状态 | 说明 |
|------|----------|------|
| `src/config/wagmi.tsx` | 已有 | 使用 `@reown/appkit-adapter-wagmi` 管理网络和连接配置 |
| `src/config/Wagmi_Provider.tsx` | 已有 | 已接入 Reown AppKit、wagmi、React Query，具备钱包连接基础 |
| `src/components/web3/ConnectButton.tsx` | 已有 | 钱包连接 UI 已存在 |
| `src/app/(APP)/ai/page.tsx` | 空页面 | AI 页面路由已预留，但还没有真正的对话或 Agent 流程 |
| `src/app/(APP)/dashboard/` | 已有 | 可作为持仓概览、USDC 余额、交易入口的承载页 |
| `src/i18n/` | 已有 | 多语言能力已具备，可覆盖后续 AI 和交易文案 |
| `@circle-fin/app-kit` | 已安装未使用 | 说明项目对 USDC / Circle 生态有潜在接入空间 |

### 2.2 当前最关键的真实差距

当前仓库尚未实现以下关键能力：

- 没有真正的链上资产读取层，例如 ERC-20 余额、Allowance、交易历史
- 没有 Base 主网优先的代币注册表和协议注册表
- 没有以 USDC 为核心结算资产的交易工作流
- 没有 AI 服务端入口，例如 `src/app/api/ai/route.ts`
- 没有交易风控层，例如白名单、限额、滑点、模拟校验
- 没有 DeFAI 编排层，例如“先分析，再报价，再确认，再签名”

结论：当前最合理的方向不是先搭“重型多智能体平台”，而是先把 **Base + USDC + EVM 读写能力** 做扎实，再让 AI 去调度这些能力。


## 三、产品定位调整

### 3.1 更贴近当前项目的产品定义

Coolha 应优先定义为：

> 一个面向 Base 生态、以 USDC 为核心结算资产、支持 EVM 钱包连接和链下智能辅助的 DeFAI Web App。

这一定义比“全能型 AI 金融代理”更适合当前仓库现状，也更容易在短期内做出真实可用的产品。

### 3.2 首阶段的核心用户价值

优先围绕以下 4 个任务构建：

1. 连接钱包并识别用户在 Base 上的地址和网络状态
2. 读取用户在 Base 上的 USDC 余额和若干重点代币余额
3. 提供“用自然语言理解意图”的交互入口，但输出以报价、解释、提醒、建议为主
4. 在用户明确确认后，完成基于 EVM 的转账、授权、兑换等标准链上操作

### 3.3 资产与协议优先级

在早期阶段，不建议把资产范围铺得太大，建议采用“Base 优先 + USDC 中心化 + EVM 可扩展”的策略：

- **主链优先级**：Base 主网第一，Base Sepolia 作为开发和联调环境
- **结算资产优先级**：USDC 第一优先级
- **资产类型优先级**：USDC、ETH、cbBTC、若干高流动性 Base 生态代币
- **协议优先级**：先接聚合报价或 DEX 路由，再逐步扩展借贷、收益、RWA
- **AI 能力优先级**：先做问答、解释、风控提示，再做策略生成和 Agent 编排


## 四、推荐技术方向

### 4.1 保留并强化当前技术栈

当前项目最适合继续沿用以下技术组合：

| 层级 | 技术 | 角色 |
|------|------|------|
| 前端框架 | Next.js 16 + React 19 | 页面、路由、服务端接口、数据编排 |
| 语言 | TypeScript | 前后端统一类型 |
| UI | Tailwind CSS + 当前 UI 组件 | 快速搭建交易和 AI 页面 |
| 钱包连接 | `@reown/appkit` + wagmi | 钱包连接、网络状态、签名入口 |
| 链上调用 | viem | 读合约、写合约、编码 calldata |
| 数据缓存 | React Query | 链上数据和 API 请求缓存 |
| 国际化 | next-intl | 支持中英文及后续扩展 |

这条路线的优势是：与当前仓库高度一致，不需要立刻引入新的重型前后端体系。

### 4.2 Base、USDC、EVM 方向的具体建议

#### 4.2.1 Base 作为默认链

建议将 Base 从“已支持网络之一”提升为“默认业务链”：

- 开发环境默认使用 `baseSepolia`
- 生产环境默认使用 `base`
- 首页、AI 页、Dashboard 都围绕 Base 资产视图设计
- UI 层明确展示当前是否在 Base 网络

#### 4.2.2 USDC 作为核心结算资产

DeFAI 早期阶段最适合围绕 USDC 构建，原因包括：

- 用户更容易理解交易结果和风险
- 风控、限额、报价、模拟都更容易统一
- 后续接入支付、收益、借贷、RWA 映射时更自然
- Base 生态中 USDC 的流动性和可组合性更适合做基础资产

建议所有金额限制、风控阈值、策略输出都统一折算到 **USDC 视角**。

#### 4.2.3 EVM 兼容而不是 Base 独占

虽然第一阶段主打 Base，但底层结构应保持 EVM 通用：

- 代币数据结构使用标准 ERC-20 抽象
- 交易能力围绕 `readContract`、`writeContract`、`simulateContract` 组织
- 链配置、代币配置、协议配置全部拆成注册表
- 未来扩展到 Arbitrum、Optimism、Ethereum 主网时尽量不改业务层

### 4.3 AI 与 Agent 的建议路线

当前阶段不建议一开始就把核心能力绑定在 `Base MCP + AgentKit + 多智能体` 上，原因是：

- 当前仓库还没有成熟的链上交易抽象层
- AI 页还是空白，先做 MCP 并不能直接带来用户价值
- 项目更需要先打通真实的钱包、报价、签名、风控流程

因此推荐的顺序是：

1. 先做 `Next.js API Route + LLM 调用 + 本地工具函数`
2. 再把工具函数抽象成可复用的 `AI Tools`
3. 最后再评估是否接入 Base MCP / AgentKit 作为增强层

换句话说，**Base MCP 是增强项，不应该是第一阶段的前置依赖**。


## 五、系统架构重构建议

### 5.1 总体架构

推荐采用更贴近当前项目的四层架构：

```
┌──────────────────────────────────────────────┐
│                  前端交互层                   │
│  Next.js 页面 / AI 对话 / Dashboard / Wallet │
└──────────────────────────────────────────────┘
                     │
┌──────────────────────────────────────────────┐
│                应用编排与 API 层              │
│  Route Handlers / Server Actions / AI Tools  │
└──────────────────────────────────────────────┘
                     │
┌──────────────────────────────────────────────┐
│                链上能力与风控层               │
│  viem / wagmi / Token Registry / Policy      │
└──────────────────────────────────────────────┘
                     │
┌──────────────────────────────────────────────┐
│               Base 与 EVM 协议层              │
│  Base / ERC-20 / DEX / Lending / Oracle      │
└──────────────────────────────────────────────┘
```

### 5.2 DeFAI 交互原则

DeFAI 在本项目中的落地方式应明确为：

- AI 负责解析意图、解释风险、生成执行提案
- 链上读操作可直接执行
- 链上写操作必须经过用户钱包签名
- 风控校验先于签名弹窗
- 任何策略输出默认属于“信息性参考”，不是自动投资建议


## 六、与当前代码目录对应的模块设计

### 6.1 建议保留并扩展的现有模块

| 路径 | 当前情况 | 建议方向 |
|------|----------|----------|
| `src/config/wagmi.tsx` | 已配置多网络 | 增加 `base`，让 Base 成为默认业务链 |
| `src/config/Wagmi_Provider.tsx` | 已接入 AppKit | 优化 Base 钱包体验，开放 Coinbase / Base 相关钱包入口 |
| `src/components/web3/ConnectButton.tsx` | 已存在 | 增加网络状态、地址、余额入口联动 |
| `src/app/(APP)/ai/page.tsx` | 空白 | 改造成 DeFAI 对话页和快捷操作页 |
| `src/app/(APP)/dashboard/page.tsx` | 已存在 | 改造成 Base 资产总览、USDC 中心仪表板 |
| `src/i18n/*` | 已存在 | 增加交易、AI、风控、多链文案 |

### 6.2 建议新增的业务目录

建议按“Base / Token / Quote / AI / Security”进行拆分：

| 建议新增路径 | 作用 |
|-------------|------|
| `src/lib/base/client.ts` | 统一管理 Base / EVM 的 viem public client |
| `src/lib/base/chains.ts` | 链配置、链元数据、默认链逻辑 |
| `src/lib/tokens/registry.ts` | Base 上重点代币注册表，优先收录 USDC |
| `src/lib/erc20/erc20Service.ts` | ERC-20 余额、授权、精度转换、Allowance |
| `src/lib/quotes/quoteService.ts` | 报价、滑点、路由摘要 |
| `src/lib/trade/tradeService.ts` | 组装交易请求和执行前校验 |
| `src/lib/security/policyValidator.ts` | 白名单、黑名单、USDC 限额、滑点检查 |
| `src/lib/ai/tools.ts` | 供 AI 调用的链上读写工具 |
| `src/lib/ai/prompts.ts` | DeFAI 对话模板和系统约束 |
| `src/app/api/ai/route.ts` | AI 请求入口 |
| `src/app/api/portfolio/route.ts` | 持仓聚合接口 |
| `src/app/api/quote/route.ts` | 报价接口 |

### 6.3 Token Registry 建议

第一阶段建议不要依赖任意散落的代币地址，而是先建立 Base 主链的注册表：

```ts
export type TokenMeta = {
  chainId: number
  address: `0x${string}`
  symbol: string
  name: string
  decimals: number
  isStable?: boolean
  isNativeWrapped?: boolean
}
```

优先维护以下类别：

- Base USDC
- WETH
- cbBTC
- 你后续计划支持的 RWA 映射代币
- AI 页面和 Dashboard 需要优先展示的代币


## 七、围绕 USDC 的核心工作流

### 7.1 资产查看

最先落地的读操作应包括：

- 读取 Base 上的 USDC 余额
- 读取 ETH 余额和 Gas 预估
- 读取若干重点 ERC-20 余额
- 汇总为 Dashboard 资产卡片

### 7.2 USDC 转账

这是最容易做、最能体现实际价值的写操作之一：

1. 用户输入“向某地址转 50 USDC”
2. AI 或表单解析出地址、金额、代币
3. 前端展示目标地址、金额、网络、Gas
4. 钱包发起 ERC-20 `transfer`
5. 记录状态、哈希和确认结果

### 7.3 USDC 兑换

第二个重点工作流是“其他资产换 USDC”或“USDC 换目标资产”：

1. 用户输入“把 100 USDC 换成 ETH”
2. 报价服务返回路由、预估到账、滑点、Gas
3. 风控层判断是否超限、是否在白名单内
4. 前端展示最终交易确认信息
5. 用户签名完成兑换

### 7.4 AI 驱动的 DeFAI 交易流程

建议采用以下链路：

```
用户输入自然语言
→ AI 识别意图
→ 调用链上读工具获取余额/价格/网络
→ 生成结构化执行提案
→ 风控校验
→ 前端确认
→ 钱包签名
→ 返回交易结果
```

这条链路与当前 Next.js 前端架构兼容，不依赖先建设完整 Agent 平台。


## 八、Base 生态能力的引入顺序

### 8.1 第一优先级：Base 原生钱包体验

当前项目已经有 `@reown/appkit`，应优先把 Base 钱包体验做完整：

- Base 主网和 Base Sepolia 的默认切换
- 网络错误提示和一键切网
- 更清晰的钱包连接状态
- 面向 Base 用户的钱包入口优化

### 8.2 第二优先级：Base DeFi 协议读写

先接最核心的链上操作，而不是一次性接全生态：

- ERC-20 余额
- ERC-20 授权
- Swap 报价
- Swap 执行
- 交易历史查询

### 8.3 第三优先级：Base AI 能力增强

当核心工作流稳定后，再评估引入：

- Base MCP
- AgentKit
- x402
- Builder Codes
- 更多 Base 原生协议技能

这样能避免“技术栈很先进，但核心用户流程还没跑通”的问题。


## 九、实施路线图

### Phase 1：Base 与 USDC 基础设施（2-3 周）

目标：让项目真正成为一个可用的 Base 资产前端。

| 任务 | 内容 | 关联文件 |
|------|------|----------|
| 1. Base 默认链调整 | 在 `src/config/wagmi.tsx` 中加入 `base`，开发默认 `baseSepolia`，生产默认 `base` | `src/config/wagmi.tsx` |
| 2. 钱包体验优化 | 调整 Provider、网络提示、Base 图标和连接体验 | `src/config/Wagmi_Provider.tsx` |
| 3. USDC 注册表 | 建立 Base 代币注册表，优先录入 USDC | `src/lib/tokens/registry.ts` |
| 4. ERC-20 读能力 | 读取 USDC / ETH / 重点代币余额 | `src/lib/erc20/*` |
| 5. Dashboard 升级 | 展示 Base 地址、网络、USDC 余额、重点资产 | `src/app/(APP)/dashboard/*` |

### Phase 2：DeFAI 对话与交易执行（2-4 周）

目标：把 AI 页从空白页升级成可用的智能交互页。

| 任务 | 内容 |
|------|------|
| 2.1 AI 对话页 | `src/app/(APP)/ai/page.tsx` 改成对话 + 快捷操作 |
| 2.2 AI API | 新增 `src/app/api/ai/route.ts`，支持意图识别和工具调用 |
| 2.3 报价接口 | 新增 `src/app/api/quote/route.ts` |
| 2.4 USDC 转账 | 支持 AI 或表单驱动的 USDC 转账 |
| 2.5 USDC 兑换 | 支持“换成 USDC / 用 USDC 买入” |
| 2.6 风控校验 | 白名单、金额上限、滑点阈值、目标地址校验 |

### Phase 3：Base DeFAI 能力增强（3-4 周）

目标：让 AI 从“会说”升级成“会分析、会调用工具”。

| 任务 | 内容 |
|------|------|
| 3.1 AI 工具层 | 把余额读取、报价、转账、兑换封装为标准工具 |
| 3.2 Portfolio 分析 | 输出 Base 资产分布、USDC 占比、风险提示 |
| 3.3 Watchlist / Alert | 基于 Base 资产和 USDC 波动做提醒 |
| 3.4 历史记录 | 记录 AI 提案、用户确认、交易结果 |

### Phase 4：增强型 Base Agent 能力（可选）

目标：在核心流程跑通后，再接入更强的生态能力。

| 任务 | 内容 |
|------|------|
| 4.1 Base MCP | 作为增强型执行网关，而不是第一阶段依赖 |
| 4.2 AgentKit | 用于多工具编排和更复杂的 Agent 调度 |
| 4.3 x402 | 用于按次付费的数据能力 |
| 4.4 多协议扩展 | 从 Swap 扩展到借贷、收益、RWA 资产操作 |


## 十、风控与合规边界

### 10.1 风控原则

本项目所有链上写操作都必须遵守以下规则：

- 用户自己连接钱包、自己签名
- 平台不托管私钥
- 先风控、后签名
- 默认以 USDC 口径做金额上限控制
- 非白名单资产或异常地址默认拦截

### 10.2 AI 输出边界

AI 页面中的内容应明确分层：

- **事实层**：余额、价格、Gas、路由、代币信息
- **解释层**：为什么建议这样做、有哪些风险
- **提案层**：结构化交易提案
- **执行层**：仅在用户确认后才进入钱包签名

任何涉及收益预测、资产配置建议的内容，默认都应标记为“信息性参考，不构成投资建议”。


## 十一、最终建议

对当前 Coolha 项目而言，最正确的技术方向不是先把文档写成一个庞大的“Base AI 超级代理平台”，而是先把下面这条主线做透：

**Next.js 前端壳层 → Base 钱包连接 → USDC 资产能力 → EVM 交易抽象 → AI 意图解析 → DeFAI 执行提案**

这条路线有 5 个现实优势：

1. 与当前代码仓库高度一致，迁移成本最低
2. 能最快做出真实可用的 Base/USDC 产品闭环
3. 风控边界清晰，适合逐步增强
4. 便于后续扩展 RWA、借贷、收益和多链
5. 为未来接入 Base MCP、AgentKit、x402 预留了清晰位置

一句话总结：

> Coolha 现阶段最适合做成一个 **Base-first、USDC-first、EVM-compatible、AI-assisted 的 DeFAI Web App**，而不是一开始就做成一个重型全自动代理系统。
