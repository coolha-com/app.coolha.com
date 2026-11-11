# 归档文档

这里的文档**不是被删除，而是已经失效**——它们描述的产品形态、定价或技术方案，代码里已经不存在了。
留在这里是为了让「当初为什么这么做、后来为什么改」有据可查，**不要按这里的结论做事**。

归档日期：2026-11-11

## 为什么归档

2026-11-11 商业模型与登录方式发生了两次根本性调整：

1. **四档订阅（Free / Plus / Pro / Max）全部取消**，改为一次性购买 Agent 服务（$19/次），法币走 Waffo。
2. **BYOK 与免费聊天下线**，用户不再自带 API Key，模型由平台提供赞助额度。
3. **登录方式改为 Web2 为主**（Neon Auth 邮箱验证码 / 密码 / Google），钱包签名降为第二凭证。

因此下列文档的结论（档位矩阵、BYOK 连接、Credits 购买、`/ai` 模块结构）已经与代码不符。

## 清单

| 文档 | 原主题 | 失效原因 |
|---|---|---|
| `ACCOUNT_TIER_DESIGN.md` | 账号体系 + 四档权益分层 | 四档取消；BYOK 已下线 |
| `PRICING_AND_ENTITLEMENTS.md` | 四档定价、权益矩阵、链上计费 | 四档取消；改为一次性 $19 + 法币 |
| `PLAYGROUND_ACCESS_AND_BILLING_PLAN.md` | 「只卖软件订阅 + 用户自带 Key」定案 | BYOK 下线，方案作废 |
| `ROUTE_A_BUSINESS_MODEL.md` | A 路线：留在 AI Gateway + 卖 Credits | 改为 AaaS，只卖 Agent 执行与平台服务 |
| `WEB3_AI_WORKBENCH_PRD.md` | Web3 AI 工作台 PRD（以 BYOK 工作台为前提） | 产品形态已改为 Agent 执行平台 |
| `COMPUTE_MARKET_PHASE0_AUDIT.md` | 2026-10-14 的代码审计快照 | 只反映当时状态，代码已大幅变更 |

## 仍然有效的结论去哪找

- **身份 / 登录 / 计费架构** → `../ARCHITECTURE_IDENTITY_BILLING.md`（已更新到 Web2 为主）
- **哪些能力真有执行点** → `../ENTITLEMENT_ENFORCEMENT_STATUS.md`（§14 执行点清单仍有效）
- **模型目录与赞助判定** → `../AI_GATEWAY_MODELS.md`
- **本地开发与数据库分支** → `../LOCAL_DEV.md`
- **当前产品全貌** → `../PROJECT_OVERVIEW.md`
