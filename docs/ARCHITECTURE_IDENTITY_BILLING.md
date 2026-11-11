# 架构决策：身份、计费与统一鉴权（ADR）

- 日期：2026-10-15
- 状态：已决定（统一鉴权已落地；身份/计费分层为 Phase 3 实施基准）
- 背景：算力市场需要「钱包连接 → 签名鉴权 → 计费」的完整身份链路。本文回答三个问题：① 连接与签名能否统一；② 用户唯一 ID 是什么；③ 计费地址是否应与身份地址分离。

## 决策一：连接与签名统一为一个流程（One-Click Auth）✅ 已落地

**结论：可以，且已实现。** Reown AppKit 1.8.24 内置 SIWE 统一流程（`createAppKit({ siweConfig })`，One-Click Auth）：用户在同一个弹窗内完成「连接钱包 + SIWE 签名」，社交/邮箱登录会自动创建嵌入式钱包（真实 EVM 地址）并无感完成签名。

实现（2026-10-15）：

- `src/config/siwe.ts` — `createSIWEConfig` 适配层，四个回调桥接到自建后端：
  | AppKit 回调 | 自建路由 |
  |---|---|
  | `getNonce` | `GET /api/wallet-auth/nonce` |
  | `createMessage` | siwe 库本地构造（EIP-4361） |
  | `verifyMessage` | `POST /api/wallet-auth/verify` |
  | `getSession` | `GET /api/wallet-auth/session` |
  | `signOut` | `POST /api/wallet-auth/signout` |
- `src/config/Wagmi_Provider.tsx` — `createAppKit` 传入 `siweConfig`（`required: false`：取消签名不断链，可经侧边栏「签名登录」按钮重试）。
- **单一会话来源**：统一流程与手动按钮、未来的 API Key 鉴权，共用 `/api/wallet-auth/*` 同一套会话（httpOnly Cookie + 服务端可撤销会话表）。
- 版本事实：`@reown/appkit-siwe@1.8.24` 与 `@reown/appkit@1.8.24` 精确匹配；`@reown/appkit-siwx@1.8.24`（多链 SIWX）为后续演进选项，其 `ReownAuthentication` 为 Reown 云托管会话，不符合自建后端目标，暂不采用。

## 决策二：用户唯一 ID = 内部 user_id，EVM 地址是身份锚点（可多个）

**结论：不要把「人」等同于「地址」。**

- **外部身份锚点**：EVM 地址（`0x...`）。它是所有权的密码学证明，SIWE 验签通过即证明控制权。
- **内部唯一 ID**：`user_id`（UUID）。一个人可以拥有多个地址（换钱包、社交嵌入式钱包、硬件钱包、多链账号）；地址是凭证，不是人。
- **落地演进**：
  - 现状（已建）：`wallet_users.address` 为主键——单身份场景够用。
  - Phase 3：引入 `users(id UUID)` + `user_identities(user_id, address, kind, created_at)`，`wallet_users` 演进为 identities 的一种（`kind='signing'`）；所有业务外键（API Key、订单、账本）指向 `user_id`，不直接指向地址。
  - 多地址归属同一 user 的合并/链接流程（如用已登录会话添加第二个地址）在 Phase 3 实现。

## 决策三：计费地址与身份地址分离 ✅ 采纳为用户既定原则

**结论：身份地址只签名、不碰钱；资金走独立计费地址。**

| 维度 | 身份地址（signing） | 计费地址（billing） |
|---|---|---|
| 用途 | SIWE 签名、登录态、API Key 绑定 | 充值资金来源、提现/退款去向 |
| 数量 | 可多个（链接到同一 user） | 可多个（打标签管理） |
| 权限 | 证明「你是谁」 | 证明「钱从哪来」；**无任何鉴权权** |
| 泄露后果 | 低（只暴露登录行为） | 高（暴露资金历史）——故必须隔离 |

- **余额归属 user_id，不归属任何地址**。充值 = 从计费地址向 Coolha 收款地址转账 + 订单引用（user_id/order_id 编码进备注或独立订单表匹配），入账走幂等账本。
- 隔离的是**应用层关联性**（外人无法从身份地址推知充值地址与余额）；链上转账本身公开，这不是链上匿名，向用户披露时不得夸大。
- Phase 3 schema：`billing_addresses(user_id, address, label)` + 充值订单携带 `user_id` 引用；`compute_ledger` 全部挂 `user_id`。
- 风控意义：签名私钥（热、高频使用）与资金私钥（冷、低频）分离， compromise 爆炸半径最小化；团队场景下「登录人」与「付款人」可不同。

## 决策四：不开启智能账户（2026-10-15）— ⚠️ 已被现实推翻，见决策六

**结论：项目不使用 ERC-4337 智能账户 / 账号抽象钱包。** 所有账户均为 EOA：普通 Web3 钱包（MetaMask 等）+ 社交登录创建的 MPC 嵌入式钱包（Reown 默认形态，产出标准 ECDSA 签名）。

> **2026-11-11 更正**：Reown AppKit 的 Smart Account 对嵌入式钱包（邮箱/社交登录）**默认开启**，签出的是 ERC-1271 / ERC-6492 签名，不是 ECDSA。因此「不需要 1271/6492 验签」这个前提是错的，已按决策六补上。下文其余判断（不作为唯一 ID、counterfactual 地址不稳定）仍然成立。

- 影响：服务端验签保持 **ecrecover 恢复地址比对**（现有 `/api/wallet-auth/verify` 已覆盖全部账户类型），**不需要 EIP-1271/6492 链上验证**。
- 若未来开启智能账户：需按账户类型分流验签（EOA 走 recover，合约地址走 `isValidSignature` eth_call），且 counterfactual 地址不稳定，作为唯一 ID 需更谨慎。
- 附带决定：侧边栏不放「签名登录」入口（UI 过于靠前且暂无功能消费）。`WalletSignIn` 组件、`useWalletAuth` hook、`/api/wallet-auth/*` 路由全部保留待用；**UI 入口随 Phase 2 API Key 功能一起在 `/ai/api-keys` 页提供**（签名在有消费场景时才对用户有意义）。

## 决策五：Web2 为主登录方式，钱包为第二凭证（2026-11-11）

**结论：用户默认用邮箱验证码（Web2）登录，钱包签名降级为可选入口；两者收敛到同一个 `users.id`。**

理由：目标用户绝大多数没有钱包，「为了用 AI 服务先装 MetaMask」是硬门槛。而 `users` / `user_identities` 两层表结构本来就支持多凭证，不需要改模型，只需要把「会话绑地址」改成「会话绑人」。

落地：

| 层 | 实现 |
|---|---|
| Web2 身份提供方 | Neon Auth（Managed Better Auth），`neon_auth` schema，与业务库同库不同 schema |
| 邮箱验证码 | `POST /api/auth/email-otp/send-verification-otp` + `POST /api/auth/sign-in/email-otp`，经 `/api/auth/[...path]` 代理，Cookie 第一方 |
| Google 登录 | `POST /api/auth/sign-in/social` → Neon Auth 托管授权 → 回调带 `neon_auth_session_verifier` 回到本域换会话 |
| 统一会话 | `src/lib/neon/session.ts` 的 `getCurrentUser()`：先读 Neon Auth 会话，再读钱包会话 |
| 身份表 | `user_identities.kind ∈ evm_signing \| email \| neon_auth` |
| 合并规则 | 已验证邮箱是合流点：先邮箱后 Google / 先 Google 后邮箱，都是同一个 `users.id`；**未验证邮箱不参与合并** |
| 钱包绑定 | SIWE 验签成功且当前有 Web2 会话时，`bindWalletToUser()` 把地址挂到当前账号；地址已属他人则**不抢占**（`conflict=true`） |

关键约束：

- `getCurrentUser()` 优先 Web2：浏览器里同时有钱包会话时不能被钱包顶掉身份（钱包会话可能是同一台机器上别人的）。
- 会话 Cookie 与用户映射分离：会话仍按凭证（地址 / Neon Auth session）签发，`users.id` 在读取时解析，避免会话指向过期用户。
- 业务主键永远是 `users.id::text`；`ai_gateway_usage` 已拆出 `subject` 列，不再把 `users.id` 塞进 `wallet_address`。

## 实施状态

| 项 | 状态 |
|---|---|
| One-Click Auth 统一流程 | ✅ 已落地（`src/config/siwe.ts` + `siweConfig`），tsc/lint/build 通过 |
| SIWE 后端 + 会话 | ✅ `db/migrations/001_wallet_auth.sql` + `/api/wallet-auth/*`，端到端 8/8 通过 |
| ERC-1271 / 6492 验签 | ✅ `src/lib/web3/siwe-signature.ts`（`publicClient.verifyMessage`），社交登录才真正可用 |
| users / user_identities / billing_addresses 表 | ✅ `db/migrations/006`，业务 subject 已全部切到 `users.id::text` |
| Web2 登录（邮箱验证码 + Google） | ✅ `db/migrations/012` + `src/lib/neon/session.ts` + `/signin` |
| 多凭证绑定（钱包 ↔ 账号） | ✅ `bindWalletToUser()`；暂不支持两个已有账号的权益合并（不可逆操作，需显式确认流程） |

## 复核条件

- 若接入 SIWX 多链（非 EVM 身份）：重新评估 `@reown/appkit-siwx` 的 SIWXConfig 自实现路径。
- 若出现「两个账号要合并」的真实需求：需要单独设计「证明同时持有两边凭证 → 迁移权益 → 保留审计」的流程，不能在一次登录里顺手做。
- 若 Neon Auth 改用自定义 SMTP 或新增社交提供方：只需改 Neon 控制台，本项目代码不用动（身份种类仍是 `neon_auth`）。
- 若计费地址需要找零/退款原路返回：账本需记录 source address 与 tx 映射。
