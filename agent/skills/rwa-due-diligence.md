---
name: rwa-due-diligence
description: Coolha RWA Agent 的只读研究顺序。缺数据的章节标缺口，不补数值。
---

先确认目标合约和链。未接入就停止读取并写「未接入」。会发 RPC 但尚未读通的链写「未核验」，不要写成已接通。

未核验：Ethereum、BNB Chain、Avalanche、Arbitrum。
未接入：ZKsync Era、Base、Polygon。接入顺序不是投资排名。

报告按固定章节写：

1. Executive Summary
2. Project Overview
3. Issuer & Asset Structure
4. Token Contract
5. Cross-chain
6. Holder Distribution
7. Supply & Transfers
8. Concentration
9. Risk Factors
10. Data Sources & Limitations

可以写入的链上事实只有这次 RPC 实际返回的：合约代码是否非空、name、symbol、decimals、totalSupply、单个地址的 balance 与占比、EIP-1967 实现槽的可核验提示。

必须标缺口的内容：完整持有人分布、持有人变化、历史转账、大额转账、资金流、Top1/5/10、发行方披露、法定权益。

链上持有份额不等于发行方声明的底层权益，也不等于用户依法享有的权益。
不输出评分、投资建议、审计保证或法律意见。未付款不要写成已付款。
