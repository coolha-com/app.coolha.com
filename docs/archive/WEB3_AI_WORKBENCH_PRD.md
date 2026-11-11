# Coolha Web3 AI 工作台 — 产品文档（PRD v0.1）

- **文档日期**：2026-10-16
- **文档性质**：产品研究与设计参考（PRD），供决策评审，不直接触发开发排期
- **研究输入**：用户竞品调研长文（2026-10）+ 8 个官网/文档链接实测 + ethereum.org agent-tooling 目录全量梳理 + x402 / ERC-7710 协议资料核实
- **产品假设**：「这个 AI 产品」指 app.coolha.com 现有 `/ai` 算力市场模块。本文档设计的是它的下一步演进：从「多模型入口」升级为「Web3 通用 AI 工作台 + 可授权 AI Agent」，不新开产品线
- **关联文档**：《PRICING_AND_ENTITLEMENTS.md》（档位与权益）、《ARCHITECTURE_IDENTITY_BILLING.md》（身份与计费）、《COMPUTE_MARKET_PHASE0_AUDIT.md》（Phase 0 审计）

---

## 0. 结论摘要（TL;DR）

1. **竞品核实结论修正**：你原文中几个产品的定位已经变化——Nani 已转型为开源自治 Agent 技术栈（agentek 165 个工具 + 自训 2B 模型，96% 工具调用准确率）；Arena 已变成 Robinhood Chain 上的 AI vault 募资产品（存 ETH 进 Claude/GPT/Gemini/Grok 管理的金库，0.5% 存款费 + 10% 利润分成）；Bankr 定位为「agent 经济的基础设施」（自称累计 $5.6B 交易量、$24M creator fees、1471 亿 LLM tokens）。**目前与我们的目标最像的竞品是 Capminal**：AI 终端 + OpenCAP 多模型推理网关 + DeFAI Agent 三合一，但它绑定 $CAP 代币经济，无 BYOK，钱包连接方式不透明。

2. **行业已收敛出三套标准，我们应该直接站在标准上，而不是自建平行体系**：
   - 工具分发 = **MCP + Agent Skills**（ethereum.org 目录已有 31 个：Tenderly 59 个模拟/调试工具、Alchemy 100+ 链数据、Slither 审计、wikipethia 规范检索、DefiLlama 23 个分析工具等）
   - Agent 授权 = **EIP-7702 + ERC-7715 + ERC-7710**（EOA 原位升级智能账户；人话授权界面；委托 + caveat 由**链上**强制限额/白名单/时效，agent 违约即回滚）
   - Agent 支付 = **x402**（Coinbase 提出，2026-07 起由 Linux Foundation x402 Foundation 治理，Visa/Mastercard/Stripe/Google/AWS/Cloudflare 等 40+ 成员；HTTP 402 + USDC 按次结算）

3. **市场空白 = 我们的位置**：现有产品要么是垂直交易终端（Rigoblock/Capminal/Arena）、要么是开发者基础设施（MetaMask Agent Wallet CLI、Morpho/Pendle MCP）、要么绑定自有代币与自有金库。**没有一个「浏览器打开即用、连接你自己的钱包、多模型、只读研究免费、写操作受治理、Agent 授权可撤销」的通用工作台**——这正是我们的空位，且与我们已建成的资产（SIWE 身份、订阅计费、BYOK、链上收款）天然衔接。

4. **合规上完全可行的形态已经验证**：MetaMask Agent Wallet 的「用户自定义限额 + 交易模拟 + Blockaid 威胁扫描 + MEV 保护」和 Base MCP 的「服务端永不持钥、构造待签请求由用户钱包签」两个模式，证明「AI 执行 + 用户主权」可以产品化。我们的版本叠加自有红线：**密钥永不离开用户浏览器、卖软件能力不卖算力、授权链上强制、随时可撤**。

5. **落地路径**：四期推进，每期独立可用、风险递增——Phase 1 只读研究（无签名，2-3 周）→ Phase 2 受治理的写操作 → Phase 3 Agent 授权自治 → Phase 4 MCP 开放 + x402 计费。**Phase 1 不碰任何签名路径，是验证 PMF 的最低风险起点。**

---

## 1. 竞品研究结论（2026-10-16 官网实测）

### 1.1 竞品矩阵（在你原文基础上修正补充）

| 产品 | 核实后定位 | 现有钱包连接 | 链上执行 | 多模型 | 关键事实（官网/文档） |
| --- | --- | --- | --- | --- | --- |
| **Capminal** | AI 交易终端 + 推理网关 + DeFAI Agent | 需实测，官网未明示 | 兑换/转账/代币部署管理 | 有（OpenCAP：聊天/图像/视频统一入口，OpenAI 兼容 API） | 「Perpetual AI Compute」：质押 $CAP 铸 $CAPU 赚每日推理额度；代币发射接 Liquid/Clanker/Virtuals。**最像我们的竞品，但代币门槛 + 无 BYOK** |
| **Rigoblock Trader** | 智能金库交易终端 | MetaMask / WalletConnect | DeFi 强（金库/兑换/流动性/跨链，GMX V2 永续） | 有（Kimi K2.7 默认 / OpenRouter 100+ / Anthropic、OpenAI 直连） | Swap Shield / NAV Shield 风控参数；Alpha 阶段；提供 x402 API 供外部 Agent 按次付费。核心绑定自家金库生态 |
| **MetaMask Agent Wallet** | 自托管 Agent 钱包（CLI） | 非 DApp 形态：`mm` CLI + skills + npm 插件 | 强：转账/签名/兑换/跨链/Hyperliquid 永续/Polymarket/Aave 金库/x402 付费墙 | 未明示（模型选择未在文档页确认） | 用户自定义限额、Guard/Beast 模式、2FA、流出限额；Blockaid 威胁扫描 + Smart Transactions MEV 保护 + $10K/月交易保障。**框架兼容列表（Claude Code 等）本文档页未列明，以 Quickstart 为准** |
| **Bankr** | Agent 经济基础设施 | Agent 形态（X/Web 交互） | 交易/组合/代币发射/DeFi/50+ 链跨链（Symbiosis） | 未明示 | Skills 目录：自然语言交易、ERC-20 + Uniswap V4 部署、预测市场；自称 $5.6B 累计交易量、$24M creator fees、1471 亿 LLM tokens；$BNKR 质押 |
| **Arena Trader** | Robinhood Chain AI vault 市场 | 存 ETH 进 vault | vault 内 AI 交易（meme/代币化股票） | 有（Claude/Gemini/GPT/Grok 四个 vault） | 纯英文策略 → 90 天真实 K 线回放 → 上线；0.5% 存款费 + 10% 利润分成，creator 留 75%；$ARENA 回购销毁。**已不是「连接钱包的通用工具」，是资金产品** |
| **Nani** | 开源自治 Agent 技术栈 | macOS 本地 Agent | Intents Engine：自然语言转交易 | 有（自训 nani-qwen-3.5-2B，103 个工具 96% 准确率） | agentek 165 个组合工具、ERC-4337 智能账户（Solady）、dao-delegate（云 KMS 签投票）。**原文「导入助记词的钱包 App」定位已过时** |
| **Morpho Agents** | 借贷协议 Agent 接口（beta） | 任意钱包基础设施 | 读/模拟/写（每笔写先过模拟） | 无 | CLI + MCP server，Ethereum + Base |
| **Pendle AI** | 收益协议 AI 插件（MIT 开源） | 面向 Claude Code/Cursor/Windsurf | 收益代币交易/LP/限价单 | 无 | 25 个 MCP 工具 + 4 个 skills，7 条 EVM 链 |

**共同缺口**：以上没有一款同时覆盖「智能合约开发 + 链上研究 + DeFi 执行 + 多模型调用」，且都以连接你自己现有钱包的方式提供。这正是你最初筛选标准落空的原因，也是我们的机会。

### 1.2 行业格局：三个收敛 + 一个缺口

**收敛 1：工具分发标准化为 MCP + Skills。** ethereum.org 的 agent-tooling 目录（2026-10 核实共 31 项）已按「MCP servers（15）+ Agent skills（15）+ 其他（1）」组织。可即插即用的关键件：

| 组件 | 能力 | 对我们的用途 |
| --- | --- | --- |
| Tenderly MCP | ~59 个工具：交易模拟、虚拟测试网、call trace/事件检查 | 写操作的「模拟」闸门（§5.4） |
| Alchemy MCP | 100+ 链数据与 RPC | 数据底座（项目已有 Alchemy key） |
| Slither MCP / sc-auditor / Pashov / QuillShield | Solidity 静态分析、安全审计 | 合约开发/审查能力 |
| wikipethia | EIP/ERC/规范/ethresear.ch 检索，**带来源引用** | 链上研究能力（注意：论坛内容仅限非商用，商用时需换源或自建语料） |
| DefiLlama Skills | ~23 个 DeFi 分析工具（TVL/稳定币/收益策略） | 协议研究能力 |
| Base MCP | 「服务端永不持钥，构造待签请求由 Base Account 签」+ Morpho/Moonwell/Aerodrome/Uniswap 等技能插件 | 写操作签名流的产品范式 |
| 1inch AI | 托管 MCP：兑换报价与限价单 | 兑换执行 |
| Morpho Agents / Pendle AI | 借贷/收益的读-模拟-写 | 协议级执行工具 |
| SIWA（Sign In With Agent） | 基于 ERC-8004 + ERC-8128，**有 Next.js SDK** | Agent 调用我们 API 时的身份鉴别 |
| request-wallet-sign | CLI：Agent 通过浏览器向人类请求签名，永不持钥 | 签名请求交互的参考实现 |

**收敛 2：Agent 授权标准化为 EIP-7702 + ERC-7715 + ERC-7710。** MetaMask Delegation Framework 的生产实践（Clawnch、remit 已验证）：

- **EIP-7702**：用户 EOA 原位升级为智能账户，同地址、无迁移、资金不动。
- **ERC-7715 Advanced Permissions**：dApp 请求 `wallet_requestExecutionPermissions`，钱包弹出人话授权页（资产/金额/期限/约束一览，用户可调参），底层生成 ERC-7710 委托。
- **ERC-7710 委托 + caveat enforcer**：限额（周期/流式/单笔）、调用频次、合约与方法白名单、有效期——**由链上合约强制，agent 越界即 revert**，不是「agent 承诺守规矩」。子代理可再授权（redelegation），权限只能逐级收窄；撤销链上即时生效。
- 权限类型：`erc20-token-periodic`、`native-token-periodic`、`erc20-token-stream`、`erc20-revocation`。
- 生产先例的自治分级：Supervised（全人工）/ Training（$50/笔、$200/日、10 次/日、24h 过期）/ Autonomous（$500/笔、$2,000/周、30 天）。

**收敛 3：Agent 支付标准化为 x402。** 2026-07-14 Linux Foundation 宣布 x402 Foundation 正式运作，Coinbase 完成协议贡献，创始成员含 Visa、Mastercard、AmEx、Stripe、Adyen、Fiserv、Google、AWS、Cloudflare、Shopify、Circle、Ripple、Solana/Stellar/Monad 基金会等 40 家；AWS 已在 WAF 边缘执行 x402，Cloudflare Monetization Gateway 支持对页面/API/**MCP 工具**按次收 stablecoin。v2 规范：CAIP-2 网络标识、`exact`/`upto`/批量结算 scheme、EIP-3009（USDC 无 gas）或 Permit2（任意 ERC-20）。交易量：Base 累计约 1.19 亿笔 / $35M（2026-03，自报口径；Visa 链上分析口径 2025-05 至 2026-04 约 1.096 亿笔 / $15M 去燥后）。

**一个缺口（安全）：x402 已知五类攻击。** 2026-05 论文《Five Attacks on x402》对三个开源 SDK 和四个线上端点测出 11 个漏洞：revert-grant（先放资源后结算）、settlement preemption（抢先花掉用户的授权）、replay（一次支付重复获取，某端点一次支付被兑现 248 次）、CDN 缓存污染（代理把付费响应缓存给未付费者）、伪造服务列表。**且 facilitator 只验单笔，500 笔各自合法的支付都能过——预算与频次控制必须建在我们自己的 agent/钱包层**（论文原结论），这正好与 ERC-7710 的链上 caveat 互补：x402 管「这一次付费」，caveat 管「这个周期总共能花多少」。

### 1.3 差异化定位图

```
                 通用性（开发+研究+执行+多模型）
                        ▲
                        │
   Morpho/Pendle MCP ●  │           ┌─────────────────────────┐
   （开发者工具）        │           │  Coolha Web3 AI 工作台   │
                        │           │  （本文档产品）           │
   MetaMask Agent  ●   │           │  · 浏览器打开即用         │
   Wallet（基础设施）   │           │  · 连接你自己的钱包        │
                        │           │  · 多模型 + BYOK          │
   Bankr / Nani    ●   │           │  · 只读研究免费           │
   （Agent 技术栈）      │           │  · 写操作四道闸治理        │
                        │           │  · Agent 授权链上可撤      │
   Capminal         ●  │           └─────────────────────────┘
   Rigoblock/Arena  ●  │  （垂直交易终端/资金产品，绑定自有生态）
                        └──────────────────────────────────────▶
                    普通用户可用性（无需 CLI、无需代币、无需导入私钥）
```

---

## 2. 产品定位

### 2.1 一句话定位

**一个浏览器打开即用的 Web3 通用 AI 工作台：连接你自己的 `0x` 钱包，用任意模型对话，调用链上工具做研究、开发和执行；给 AI Agent 的每一分授权都在链上有边界、可撤销。**

内部代号：`/ai/workbench`（Phase 1 路由）。

### 2.2 与现有产品的关系

不是新产品，是 `/ai` 算力市场的 Phase 2 演进：

| 层 | 现状（已建成） | 演进为 |
| --- | --- | --- |
| 模型接入 | BYOK + AI Gateway catalog + 免费模型额度 | 不变，成为工作台的「模型层」 |
| 身份 | SIWE 钱包会话 + 四态身份（L0-L3） | 不变，叠加 EIP-7702 智能账户升级 |
| 计费 | 订阅四档 + token 日额度 + 链上收款 | 扩展「工具调用计量」与「Agent 授权额度」两个维度 |
| 能力 | 聊天/Playground | 新增「工具层 + 治理层 + Agent 层」 |

### 2.3 目标用户与核心场景

| 用户 | 场景 | 用工作台做什么 |
| --- | --- | --- |
| **Web3 研究者/投资者**（主） | 「帮我分析这个合约和它最近的资金流」 | 只读研究：合约解码、交易追踪、协议数据对比、报告生成（免费获客层） |
| **DApp/合约开发者** | 「读这个合约，找风险点，给我测试用例」 | 开发辅助：静态扫描、测试生成、部署辅助、交互脚本 |
| **DeFi 操作者** | 「把 100 USDC 换 ETH，先给我看模拟结果」 | 受治理执行：草稿 → 模拟 → 签名 → 广播 → 回执解读 |
| **效率极客/Agent 玩家** | 「以后每天用不超过 $20 在 Base 上定投 ETH，授权 30 天」 | Agent 自治：ERC-7715 授权 → Agent 周期执行 → 随时撤销 |

### 2.4 非目标（明确不做什么）

- 不做资金产品：不发行金库、不托管用户资产、不做收益策略市场（Arena/Rigoblock 的路线）
- 不绑定代币：产品能力不靠 token 解锁（Capminal 的路线）
- 不导入私钥/助记词：只支持连接你自己的钱包（与旧版 Nani 划清界限，也是我们的安全卖点）
- 不做全链覆盖：首批仅 Ethereum + Base（与订阅收款链一致），其他链按需扩展
- 不自建全部数据：能用 Alchemy/Tenderly/DefiLlama 等标准件的不自建

---

## 3. 能力架构

### 3.1 四层架构

```
┌──────────────────────────────────────────────────────────────┐
│  交互层   /ai/workbench 对话 + 工具面板 + 交易草稿卡 + Agent 管理  │
├──────────────────────────────────────────────────────────────┤
│  治理层   策略引擎（限额/白名单/频次/模拟门槛）                    │
│           · 每笔写操作四道闸：模拟 → 威胁扫描 → 策略 → 签名        │
│           · Agent 授权：EIP-7715 人话授权 → ERC-7710 caveat 链上强制│
├──────────────────────────────────────────────────────────────┤
│  工具层   MCP 风格工具注册表（四类，全部可被外部 MCP 客户端调用）    │
│           · 只读：余额/交易/合约读取/Gas/价格/协议数据（匿名+登录）   │
│           · 研究：合约分析/交易解码/规范检索/协议对比（登录）         │
│           · 开发：Solidity 生成/审查/测试/部署辅助（登录+计量）      │
│           · 执行：兑换/转账/授权管理/协议操作（登录+签名）           │
├──────────────────────────────────────────────────────────────┤
│  身份层   SIWE 会话（已有）+ EIP-7702 智能账户 + user_id 体系（已有）│
├──────────────────────────────────────────────────────────────┤
│  模型层   BYOK（浏览器直连，不出服务端）+ Gateway catalog（已有）   │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 工具层设计（核心资产）

所有工具用统一的 MCP 风格 schema 注册（name / description / inputSchema / riskLevel / authLevel），同一套 handler 双端复用：内部对话调用 + 外部 MCP server 暴露（Phase 4）。

| 类别 | 示例工具 | 风险级 | 鉴权 | 实现路径 |
| --- | --- | --- | --- | --- |
| 只读 | `get_balance`、`get_tx`、`read_contract`、`get_gas`、`get_price`、`protocol_tvl` | 只读 | 匿名可用（限额）/登录提额 | Alchemy/DefiLlama 标准件 |
| 研究 | `analyze_contract`（源码+Slither）、`decode_tx`、`search_specs`（EIP/ERC 带引用）、`compare_protocols` | 只读 | 登录 | Tenderly + Slither MCP + wikipethia 类（商用注意许可） |
| 开发 | `generate_contract`、`review_solidity`、`gen_tests`、`prepare_deploy` | 只读（产出物） | 登录 + 计入 token 额度 | 模型 + Foundry MCP 类 |
| 执行 | `quote_swap`、`build_swap_tx`、`build_transfer_tx`、`manage_approval`、`morpho_supply` | **写** | 登录 + 签名（或授权内） | 1inch/Morpho 标准件 + 自建草稿构造 |

设计原则：
1. **写工具只「构造」，不「发送」**：handler 产出交易草稿（to/data/value/模拟结果/风险提示），广播永远发生在用户签名之后（Base MCP 范式）。
2. **风险分级驱动 UI**：只读工具直接出结果；写工具必须走「草稿卡 → 模拟 → 签名」流程；研究/开发工具正常计费。
3. **每个结果带来源引用**：研究类工具输出必须附数据源与时间戳（wikipethia 范式），这是工作台对竞品的信息差卖点。

### 3.3 Agent 授权设计（Phase 3 核心）

```
用户（MetaMask，EIP-7702 升级后的智能账户）
  │  1. 自然语言描述意图：「每天最多 $20 在 Base 买 ETH，30 天」
  │  2. 授权编译器把意图编译成 caveat 组合：
  │     · erc20-token-periodic：$20/天 USDC
  │     · allowed-targets：1inch Router + WETH
  │     · timestamp：30 天后过期
  │  3. ERC-7715 人话授权页确认（MetaMask 弹出，参数可调）
  ▼
签署 ERC-7710 delegation（链上可验证，服务端只存副本）
  ▼
Agent（session account，只持签名权，不持币）
  │  4. 在授权范围内自主执行：构造 → 模拟 → 通过 DelegationManager 赎回 → 上链
  │  5. 越界操作被 caveat enforcer 直接 revert
  ▼
用户随时撤销：MetaMask Dapp connections 一键 / 我们 UI 一键（链上即时生效）
```

授权档位模板（参照 Clawnch 生产分级）：

| 档位 | 限额 | 适用 |
| --- | --- | --- |
| Supervised | 不授权，每笔人工签 | 默认，新用户 |
| Training | $50/笔、$200/日、10 次/日、24h 过期 | 试用 Agent |
| Autonomous | $500/笔、$2,000/周、30 天 | 信任后的常规策略 |
| Custom | 用户自定义边界 | 高级用户 |

非 MetaMask 钱包路径：EIP-712 委托签名对同一 DelegationManager 生效（Clawnch 双通道模式），授权体验降级但安全模型不变。

### 3.4 治理层：写操作四道闸

| 闸 | 内容 | 失败处理 |
| --- | --- | --- |
| 1. 模拟 | Tenderly/Alchemy 模拟执行，展示余额变化、approvals、gas | 模拟失败 → 阻止，不出签名请求 |
| 2. 威胁扫描 | Blockaid 类风险评分（或自建规则引擎起步：无限 approve、陌生合约、钓鱼域名库） | 高风险 → 强制人工复核；极高 → 拒绝执行 |
| 3. 策略引擎 | 服务端限额（日累计/频次/单笔上限）+ 合约白名单 + 用户档位权限 | 超限 → 拒绝并提示升级或调整 |
| 4. 签名 | 用户钱包签名（或 Agent 在授权内赎回）；MEV 保护走私有 RPC/批量提交 | 签名后广播，回执解读回流到对话 |

---

## 4. 核心用户流程

### 4.1 主流程 A：连接钱包 → 研究（零签名）

```
打开 /ai/workbench → 连接钱包（WalletConnect/注入，SIWE 签名登录，已有能力）
→ 提问「分析 0xABC 合约最近的资金流」
→ 工具层调度：read_contract + decode_tx + analyze_contract + protocol_tvl
→ 多模型综合输出（带来源引用）→ 可导出报告
```

### 4.2 主流程 B：执行（受治理）

```
「把 100 USDC 换成 ETH」→ quote_swap 报价
→ build_swap_tx 构造草稿（草稿卡展示：预计获得/滑点/价格影响/路由）
→ 模拟闸 → 威胁扫描闸 → 策略闸 → 用户确认 → 钱包签名 → 广播 → 回执解读入对话
```

### 4.3 主流程 C：Agent 自治

```
订阅用户（L3）→ /ai/agents 创建 Agent → 选模型 + 选工具权限 + 写策略（自然语言）
→ 授权编译器 → ERC-7715 授权页 → 用户确认（参数可调）
→ Agent 按周期自主执行（每笔仍过模拟闸；授权外操作链上 revert）
→ 仪表板查看执行日志 → 随时撤销
```

### 4.4 主流程 D：外部 Agent 付费调用（Phase 4）

```
外部开发者的 Agent（Claude Code 等）→ 调用我们的 MCP endpoint
→ 未付费：402 + PAYMENT-REQUIRED 头（价格/资产/网络）
→ 客户端签名 EIP-3009 USDC 授权 → PAYMENT-SIGNATURE 头重试
→ facilitator 验证结算 → 返回工具结果（我们自建预算层防重复/超支，见 §6.4）
```

### 4.5 异常流程

- 模拟失败/风险命中 → 草稿卡变红，给出具体原因与替代建议（换额度/换合约/人工复核）
- 授权额度耗尽 → Agent 暂停并通知用户，提供「提升授权」或「换 Supervised」
- 模型 key 失效/额度超限 → 回落免费模型（既有熔断逻辑）+ 引导 BYOK
- 链上拥堵/gas 飙升 → 草稿卡提示等待或调整

---

## 5. 功能需求（按优先级）

### P0 — Phase 1：工作台 + 只读/研究（无签名路径）

| # | 功能 | 验收标准 |
| --- | --- | --- |
| F1 | `/ai/workbench` 多模型对话（复用现有模型层 + 免费额度熔断） | 模型切换、BYOK、token 计量与现有 Playground 一致 |
| F2 | 工具注册表 + 12 个只读/研究工具 | MCP schema 统一注册；单工具响应 P95 < 3s；全部带来源引用 |
| F3 | 钱包连接即登录（复用 SIWE，不重复造轮子） | 连接后自动创建/关联 user_id；L0→L1→L2 状态机不变 |
| F4 | 工具调用计量（`web3_tool_calls` 表） | 按 subject + UTC 日聚合；匿名/登录/分档限额可查 |
| F5 | 研究报告导出 | 对话 + 引用可导出 Markdown/PDF |

### P1 — Phase 2：受治理的写操作

| # | 功能 | 验收标准 |
| --- | --- | --- |
| F6 | 交易草稿卡 + 四道闸流水线 | 模拟失败/高风险/超限三种阻断路径各有 UI 与文案 |
| F7 | 策略引擎（服务端限额 + 白名单 + 频次） | 限额规则可配置；越限 100% 阻断（含并发竞态） |
| F8 | 签名请求交互（参考 request-wallet-sign / Base MCP 范式） | 移动端可用；签名页显示人话摘要而非 raw calldata |
| F9 | 执行记录与回执解读 | 每笔执行落 `agent_executions`（Phase 2 起复用同表） |

### P1 — Phase 3：Agent 授权

| # | 功能 | 验收标准 |
| --- | --- | --- |
| F10 | 授权编译器（自然语言 → caveat 组合） | 覆盖四类 caveat：周期限额/单笔上限/目标白名单/有效期；拒绝无边界授权（除非显式 opt-in） |
| F11 | ERC-7715 授权 UI + 非 MetaMask 的 EIP-712 通道 | MetaMask 路径端到端跑通（Base 测试网 → 主网）；授权记录可查可撤 |
| F12 | Agent 管理与仪表板 | 创建/暂停/撤销/执行日志/额度消耗；撤销后 1 个区块内生效验证 |
| F13 | 分级自治模板（Supervised/Training/Autonomous/Custom） | 四档模板一键套用，参数可改 |

### P2 — Phase 4：开放与计费

| # | 功能 | 验收标准 |
| --- | --- | --- |
| F14 | MCP endpoint 对外开放 + SIWA 鉴权 | 外部 Claude Code/Cursor 可接；Agent 身份可鉴别可限额 |
| F15 | x402 门控（402 + USDC + facilitator） | 走通 CDP facilitator 免费层；幂等防重放；预算层独立于 facilitator |
| F16 | 工具市场（第三方 MCP 上架） | 审核流程 + 风险分级标注 + 收益分成 |

---

## 6. 技术方案与项目接线

### 6.1 复用资产（已建成，不重造）

- SIWE 钱包会话（`/api/wallet-auth/*` + 三表）→ 身份层主线
- 模型层：BYOK（浏览器直连）+ Gateway catalog + 免费额度熔断 `FREE_MODELS_ENABLED`
- 订阅与计量：`entitlements` / `usage_daily` / `subscription_orders` + 链上收款（Alchemy webhook + Cron 兜底）
- Reown AppKit + wagmi + viem（WalletConnect 已具备）
- Alchemy key（RPC + 100+ 链数据）
- `proxy.ts` 地理合规（新端点自动继承）

### 6.2 新增模块

```
src/lib/web3/
├── tools/           # MCP 风格工具注册表 + handler（四类工具）
│   ├── registry.ts  #   schema 注册、风险分级、鉴权级别
│   ├── read/        #   只读工具（Alchemy/DefiLlama 封装）
│   ├── research/    #   研究工具（Tenderly/Slither/规范检索）
│   └── execute/     #   执行工具（草稿构造，不发送）
├── policy/          # 策略引擎：限额/白名单/频次/档位权限
├── signing/         # 签名请求会话（草稿 → 待签 → 广播 → 回执）
├── agent/           # 授权管理：intent 编译、delegation 存储、撤销、赎回
└── x402/            # 402 门控中间件 + 幂等 + 预算层

db/migrations/008_web3_workbench.sql
  web3_tool_calls    # 工具调用计量（subject, tool, day, tokens, count）
  agent_grants       # 授权记录（caveats JSON、delegation 引用、状态、撤销时间）
  agent_executions   # 执行日志（含模拟结果、风险评分、tx_hash、状态）
  x402_payments      # 支付幂等（payment_id 唯一，防重放）
```

新增 API：`/api/v1/tools/*`（内部）、`/api/v1/agent/*`、`/api/v1/x402/*`（402 门控）。

新增路由：`/ai/workbench`（对话+工具）、`/ai/agents`（Agent 管理与授权）、复用 `/ai/billing`。

### 6.3 外部依赖选型

| 用途 | 选型 | 备选/说明 |
| --- | --- | --- |
| RPC/数据 | Alchemy（已有 key） | QuickNode |
| 模拟 | Tenderly（59 工具 MCP） | Alchemy simulate；注意免费额度 |
| 威胁扫描 | Blockaid API | 起步可自建规则（无限 approve/陌生合约/域名库），后续接商业 API |
| 兑换 | 1inch（托管 MCP） | 自建聚合 |
| 协议操作 | Morpho Agents 模式自建 | Pendle AI 可作技能插件参考 |
| 规范检索 | wikipethia | **商用许可存疑（论坛内容 non-commercial）**：上线前换源或自建 EIP 语料 |
| 委托框架 | MetaMask Smart Accounts Kit（ERC-7710/7715 + EIP-7702） | 自研不现实，这是事实标准 |
| x402 facilitator | CDP 托管（免费 1,000 笔/月，后 $0.001/笔） | 量产后自建 facilitator |
| Agent 身份 | SIWA（ERC-8004/8128，Next.js SDK） | 自建 API key 体系 |

### 6.4 安全设计（含 x402 攻击面自查）

**私钥边界**：服务端永不接触私钥/助记词（延续现有红线）；Agent 只持 delegation（签名权）不持币；资金在用户钱包内直到执行瞬间。

**x402 五类攻击的对策**（对应 2026-05 论文）：

| 攻击 | 对策 |
| --- | --- |
| revert-grant（先放资源后结算） | 先 verify+settle 再放行；失败即 402 重试 |
| settlement preemption | EIP-3009 授权绑定 our facilitator + nonce 管理；Permit2 场景加 spender 白名单 |
| replay（一次支付多次获取） | payment_id 幂等表 + 单次绑定（resource + params hash） |
| 代理/CDN 缓存污染 | 付费响应 `Cache-Control: private, no-store`；402 响应同样禁缓存 |
| 伪造服务列表 | 自有 facilitator 发现层（Phase 4），不盲信第三方目录 |
| 预算打洞（500 笔各自合法） | **预算层建在策略引擎 + ERC-7710 caveat，不信 facilitator 的单笔校验** |

**其他**：所有写操作先模拟后展示；授权编译拒绝无边界授权（显式 opt-in 除外）；地理合规延续（授权与 x402 结算同样受 `proxy.ts` 约束，权益授予二次校验 geo）。

---

## 7. 合规与红线（承接 + 新增）

既有红线全部延续（详见项目记忆）：
1. 卖软件能力不卖算力；推理费用由用户自己的 key 承担；免费模型额度是获客成本。
2. 用户第三方 API key 永不上行服务端。
3. 链上支付不绕过 `proxy.ts` 地理屏蔽；授予权益时二次校验。
4. 不伪造数据，空态即空态。

本产品新增红线：
5. **永不导入/托管私钥助记词**；连接钱包是唯一入口。
6. **Agent 授权链上强制、随时可撤**；服务端限额只是第一道，链上 caveat 是最终防线。
7. **x402 收入定位为软件服务费**（工具调用/Agent 调用的按次计费），不是算力转售——与「卖 token 违规、卖产品允许」的界限一致。
8. ToS 明确：授权范围内 Agent 执行的后果由用户承担；我们提供的是工具与治理，不是投资建议。
9. 商业使用第三方数据前核对许可（wikipethia 论坛语料 non-commercial 是已知风险点）。

---

## 8. 商业化与档位映射

原则：**订阅卖软件能力与额度，x402 卖按次调用，两者不交叉补贴算力成本**。

| 权益 | Free | Plus $6 | Pro $10 | Ultra $30 |
| --- | --- | --- | --- | --- |
| 只读/研究工具 | 有（限额） | 有（宽） | 有（宽） | 有（宽） |
| 每日 token 额度 | 300K | 1.5M | 6M | 25M |
| 工具调用/日 | 30 | 120 | 400 | 1200 |
| 写操作（签名执行） | — | 有 | 有 | 有 |
| Agent 数量 | — | 1 | 3 | 10 |
| Agent 授权额度上限/月 | — | $200 | $1,000 | $5,000 |
| x402 按次调用 | 按次付费 | 按次付费 | 按次付费（量折扣） | 按次付费（量折扣） |
| MCP endpoint 对外开放 | — | — | 有 | 有 |

设计说明：
- 免费层只读+研究，是获客入口；写操作与 Agent 是订阅理由；x402 面向外部开发者，是增量收入不与订阅互斥。
- 授权额度上限是**服务端软顶**，链上 caveat 是硬顶，两者取小。
- 具体数字待 Phase 1 实测后校准（工具调用成本、模型 token 成本、facilitator 费用）。

---

## 9. 路线图

| 阶段 | 周期 | 内容 | 验收标准 | 北极星指标 |
| --- | --- | --- | --- | --- |
| **Phase 1** 工作台+研究 | 2-3 周 | F1-F5 | 零签名路径上线；12 工具全可用；引用可溯源；计量准确 | 周活跃对话数；工具调用成功率 |
| **Phase 2** 受治理执行 | 3-4 周 | F6-F9 | 四道闸端到端跑通（Base 测试网→主网）；三种阻断路径有 UI；小额真实交易验证 | 草稿→签名转化率；风险拦截率 |
| **Phase 3** Agent 授权 | 3-4 周 | F10-F13 | MetaMask ERC-7715 端到端；越权 100% revert；撤销 1 区块内生效 | 授权 7 日留存；Agent 执行成功率 |
| **Phase 4** 开放+计费 | 4 周+ | F14-F16 | 外部 MCP 可接；x402 走通且通过五类攻击自查 | 外部调用量；x402 收入 |

每阶段独立可用、独立评估，不达标不进下一阶段。Phase 1 全程无签名路径，资金风险为零，是验证「Web3 AI 工作台」需求真伪的最低成本实验。

---

## 10. 风险与未决问题

| # | 风险 | 影响 | 对策 |
| --- | --- | --- | --- |
| R1 | Tenderly/Alchemy 免费额度不足以支撑模拟量 | Phase 2 成本 | 先量化模拟调用量；必要时自建模拟（anvil fork）+ 缓存 |
| R2 | EIP-7702 钱包覆盖率（非 MetaMask 用户体验降级） | Phase 3 转化 | 双通道设计已缓解；监测各钱包 7702 支持进度 |
| R3 | wikipethia 等内容源商用许可 | Phase 1 法务 | 上线前完成许可审查；必要时自建 EIP/ERC 语料（开源可商用） |
| R4 | 免费层工具滥用（爬取/刷量） | 成本 | 签名登录门槛 + 速率限制 + 设备指纹；与现有免费模型额度熔断联动 |
| R5 | x402 facilitator 依赖（CDP 免费层 1,000 笔/月） | Phase 4 规模化 | 量产后自建 facilitator（协议开放） |
| R6 | Agent 自动执行的法务边界（各地对自动化交易的态度） | Phase 3 合规 | ToS 明确授权即担责；首批仅对非受限地区开放（geo 二次校验） |
| R7 | 多链数据源成熟度（Robinhood Chain 等新链） | 范围 | 首批仅 Ethereum + Base，其余按需 |
| R8 | 竞品跟进（Capminal 加钱包连接、MetaMask 出网页版） | 差异化窗口 | 靠「治理透明度 + BYOK + 无代币 + 开放 MCP」建立迁移成本 |

未决问题（需产品决策）：
1. Agent 执行失败的 gas 损失谁承担（建议：授权内用户自担，我们的 bug 我们赔——写进 ToS）。
2. 工具调用是否独立于 token 额度计量，还是合并一套额度体系（建议：独立，避免模型额度被工具挤占）。
3. Phase 4 第三方工具上架的收入分成比例与审核标准。
4. 是否需要给研究类输出加「非投资建议」强制声明（倾向加，低成本高合规收益）。

---

## 附录 A：竞品与资料核实清单（2026-10-16）

| 来源 | 核实结论 |
| --- | --- |
| ethereum.org/developers/tools/categories/agent-tooling/ | 31 项：15 MCP servers + 15 skills + 1 CLI；关键件见 §1.2 |
| docs.metamask.io/agent-wallet | CLI 形态（`mm` + skills + npm 插件）；Blockaid/Smart Transactions/MEV；$10K/月保障；框架兼容列表未在页内列明 |
| bankr.bot | 「Capital and infra for the agent economy」；$5.6B volume / $24M creator fees / 1471 亿 LLM tokens；Skills 目录含 50+ 链跨链、ERC-20 发射 |
| nani.ooo | 已转型开源自治 Agent 栈：agentek 165 工具、nani-qwen-3.5-2B（103 工具 96%）、ERC-4337、Intents Engine、dao-delegate |
| capminal.ai | AI Terminal + OpenCAP 网关 + Agentic Chat + $CAP→$CAPU 质押额度 + Orbs 代币发射 |
| trader.rigoblock.com | 金库交易终端；Kimi K2.7 默认/OpenRouter/Anthropic/OpenAI；Swap Shield/NAV Shield；Alpha |
| arenatrader.ai | Robinhood Chain AI vault 市场；Claude/Gemini/GPT/Grok vault；90 天回放；0.5%+10% 费用；$ARENA 销毁 |
| docs.morpho.org/developers/agents/mcp | 页面为免责声明墙；经 ethereum.org 条目确认：beta，读/模拟/写，Ethereum+Base，先模拟后写 |
| docs.pendle.finance/pendle-v2/AppGuide/PendleAI | 25 MCP 工具 + 4 skills（swap/data/portfolio/order）；7 链；MIT；Claude Code/Cursor/Windsurf |
| docs.cdp.coinbase.com/x402 + x402.org | LF x402 Foundation 2026-07-14 运作，40+ 成员；v2：CAIP-2、exact/upto/batch、EIP-3009/Permit2；CDP facilitator 免费 1,000 笔/月 |
| 安全论文《Five Attacks on x402》（2026-05） | 11 漏洞 5 类；预算层必须在 agent/钱包侧（本文 §6.4 对策） |
| MetaMask Delegation 文档 + Clawnch/remit 案例 | ERC-7710/7715/EIP-7702 生产实践；自治分级与子授权收窄规则 |

## 附录 B：术语表

| 术语 | 一句话解释 |
| --- | --- |
| MCP | Model Context Protocol，AI 与工具之间的标准接口（本产品的工具分发格式） |
| Agent Skills | 给 AI agent 的知识包/技能插件格式 |
| SIWE | Sign-In With Ethereum，钱包签名登录（项目已实现） |
| EIP-7702 | EOA 原位升级为智能账户，同地址无迁移 |
| ERC-7715 | 钱包「高级权限」标准：人话授权页，底层生成 7710 委托 |
| ERC-7710 | 智能账户委托标准；caveat 使限额/白名单/时效由链上强制 |
| x402 | HTTP 402 支付协议：请求 → 402+价格 → 签名 → facilitator 结算 → 放行 |
| facilitator | x402 中替卖方验证并结算链支付的中间服务 |
| SIWA | Sign In With Agent，基于 ERC-8004/8128 的 Agent 身份标准（Next.js SDK 可用） |
| BYOK | Bring Your Own Key，用户自带模型 API key，浏览器直连不出服务端 |
