# 权益落地审计：订阅到底解锁了什么

> 审计日期：2026-10-16  
> 审计对象：`src/lib/compute/plans.ts` 定义的权益 vs 代码中真实生效的强制点  
> 结论一句话：**当前订阅只买到「更大的免费模型额度」，其余 14 项权益全是纸面配置。**  
> 而且「卖额度」恰恰是最贴近 AUP 红线的形态，必须尽快把付费价值迁移到软件能力上。



---

## 一、唯一真正生效的权益：每日配额

全仓检索 `readPlan` / `checkQuota` / `consumeQuota` / `limits.` 的消费点，结果如下：

| 调用点                   | 文件                                            | 作用               |
| --------------------- | --------------------------------------------- | ---------------- |
| `checkQuota(subject)` | `src/app/api/compute/playground/route.ts:183` | 请求前判定，超限返回 429   |
| `consumeQuota(...)`   | `src/app/api/compute/playground/route.ts:288` | 流结束后按真实 usage 记账 |
| `readPlan(...)`       | `src/app/api/wallet-auth/session/route.ts:21` | **仅用于展示**当前档位名   |
| `readPlan(...)`       | `src/app/api/subscription/orders/route.ts:89` | **仅用于展示**        |

**结论：档位只在 `/api/compute/playground` 一处产生实际约束力，形式就是 `dailyTokens` + `dailyRequests`。**

| 档位    | 每日 token | 每日次数 |
| ----- | -------- | ---- |
| Free  | 300K     | 30   |
| Plus  | 1.5M     | 120  |
| Pro   | 6M       | 400  |
| Ultra | 25M      | 1200 |

---

## 二、其余权益：零消费点（纸面配置）

原 `PlanLimits` 定义了 14 个字段，逐个 grep 结果：**除 `plans.ts` 自身的声明与赋值外，全仓无任何一处读取**。  
2026-10-16 产品决策：**团队席位方向不做**，`teamSeats` 字段已从配置中移除，剩 13 项。

| 权益字段                             | Free → Ultra                      | 代码是否强制执行                          |
| -------------------------------- | --------------------------------- | --------------------------------- |
| `byokConnections`                | 2 → 5 → 15 → 无限                   | ❌ 无（`ConnectionsManager` 无任何条数校验） |
| `historyDays` / `historyThreads` | 0 → 90 → 365 → 永久                 | ❌ 无（历史仍在 localStorage，未上云）        |
| `crossDeviceSync`                | false → true                      | ❌ 无（无任何同步实现）                      |
| `fullTextSearch`                 | false → true                      | ❌ 无                               |
| `exportScope`                    | none → single → batch → scheduled | ❌ 无（无导出功能）                        |
| `personas` / `promptTemplates`   | 1 → 10 → 无限                       | ❌ 无                               |
| `parallelCompare`                | 0 → 0 → 2 → 4                     | ❌ 无                               |
| `routingPolicies`                | false → true                      | ❌ 无                               |
| `costDashboardDays`              | 0 → 90 → 365 → 永久                 | ❌ 无                               |
| `concurrentSessions`             | 1 → 3 → 10 → 无限                   | ❌ 无                               |
| ~~`teamSeats`~~                  | —                                 | ⛔ 已移除：产品决策不做团队方向                  |
| `apiAccess`                      | false → true                      | ❌ 无                               |
| `queuePriority`                  | low → highest                     | ❌ 无                               |

同时，`/ai/billing` 的 `HIGHLIGHTS` 常量已经把这些未实现能力**当作卖点展示给用户**：

```ts
plus: ["一切 Free 能力", "服务端历史 90 天 · 跨设备同步", "5 个连接 · 单条导出", "成本看板 90 天"]
pro:  ["一切 Plus 能力", "全文检索 · 历史 365 天", "多模型并排对比 · 路由策略", "API / Webhook / MCP 出口"]
```

⚠️ **这是收钱卖未实现功能**，属于必须优先处理的风险项，而不是「以后补上就行」。

---

## 三、为什么「只卖额度」是个坏形态

1. **贴着 AUP 红线**：Vercel AI Product Terms 限制的是「转售 / 转让第三方 provider 的 key 与额度」。付费档卖「更大的赞助额度」，在解释上比「卖软件能力」更接近卖 token，辩护成本高。
2. **成本随用户增长线性上升**：订阅用户越多、额度越高，我们烧得越多——付费用户反而成了成本中心。
3. **价值锚错了**：额度是消耗品，用户每月都在「用完」；软件能力是资产（历史、检索、导出），越用越离不开。

**正确形态**：额度是获客成本（Free 档给一点让人试用），付费价值锚在**我们自己的软件与存储**上——那是零边际成本、零 AUP 风险、且用户数据沉淀在我们这里的东西。

---

## 四、按「服务端可强制」排序的实施建议

关键判据：**BYOK 走浏览器直连，不经过服务端**。凡是围绕 BYOK 的权益，在纯客户端架构下**一律无法被服务端强制**（改 localStorage 即绕过）。所以：

### 第一梯队：纯服务端，天然可强制，零 AUP 风险 ✅

| 能力                      | 依赖                                                 | 说明                                      |
| ----------------------- | -------------------------------------------------- | --------------------------------------- |
| **会话历史上云**              | 新增 `chat_threads` / `chat_messages`（006 迁移已预留结构思路） | 最硬的一道墙：数据在服务端，保留天数、条数上限、检索权限全部由 SQL 说了算 |
| **跨设备同步**               | 同上 + 连接元信息上云（**密钥本体永不上行**）                         | 用户换设备/清缓存不再丢数据，是登录最正当的理由                |
| **全文检索**                | Postgres `tsvector` + GIN 索引                       | 只有历史上云后才有意义                             |
| **导出（MD / JSON / CSV）** | 服务端历史                                              | 单条 → 批量 → 定时，天然分档                       |

> 这一梯队做完，Plus/Pro/Ultra 就有了**真实且可辩护的价值**，且不碰任何红线。

### 第二梯队：需服务端代理 BYOK，可强制但要先过合规确认 ⚠️

| 能力                                | 前提                  |
| --------------------------------- | ------------------- |
| 路由策略（fallback / 超时 / 重试 / 单次成本上限） | 请求经我们服务端转发          |
| 多模型并排对比                           | 同上                  |
| 成本看板（真实 token 计量）                 | 同上，需落 `usage_daily` |
| API / Webhook / MCP 出口            | 同上                  |

**合规判断**：用户自带 key、由我们代理转发到**他自己的会话**，属于 memory 中已确认的「BYOK 软件层」允许形态（红线是向外颁发 key 让第三方直连、以及转售）。但落地前需：(a) 明确「密钥仅用于你的会话、不出租不共享」的产品表述；(b) 传输层加密存储密钥（当前浏览器 localStorage 方案需升级为服务端加密存储）。

### ⛔ 已决定不做：团队方向

团队席位 / 共享空间 / 成员权限 / `orgs`+`members` 表与邀请流 —— **2026-10-16 明确砍掉**，不做组织模型。  
`teamSeats` 字段已从 `PlanLimits` 移除，Ultra 档 `tagline` 同步改为「永久归档与最高优先级」。  
产品定位保持**单用户**，付费价值全部锚在个人生产力（历史、检索、导出、编排）上。

---

## 五、已完成：P1 会话历史上云（008 迁移）

**两个产品决策（2026-10-16）**

1. **Free 档严格 0 云历史**：`historyDays = 0` 保持，免费用户只有本机 localStorage。云历史是纯付费墙。
2. **BYOK 会话正文全部上云**：一旦档位享有云历史，自带 Key 的对话正文同样写入服务端，用于跨设备与检索；**API Key 本体永不上行**，图片 / 文件的 dataUrl 在客户端上报前剥离为 `[附件]` 占位符，避免把 MB 级 base64 灌进数据库。设置页明示存了什么与一键清空。

**落地内容**

- `db/migrations/008_chat_history.sql`（已应用到 Neon，生产同库）：
  - `chat_threads`（subject / title / model_key / pinned / message_count / deleted_at 软删除）
  - `chat_messages`（thread_id + seq 唯一、parts jsonb、text_content 纯文本投影、`search_tsv` 生成列 + GIN 索引供 P3 全文检索）
- `src/lib/neon/chat-history.ts`：`authorizeHistory()` 统一鉴权（未登录 401 / 无权益 403 **分开报**），`listThreads` 按档位应用保留期与条数上限，`replaceMessages` 走显式事务全量覆盖（幂等），`softDeleteThread` / `purgeHistory`。
- `src/lib/neon/postgres.ts` 新增 `transaction()`（池内独占连接 BEGIN/COMMIT），供多语句原子写入。
- API：`/api/chat/threads`（GET/POST，支持客户端自带 uuid 避免二次改名）、`/api/chat/threads/[id]`（GET/PATCH/DELETE）、`/api/chat/threads/[id]/messages`（PUT）、`/api/chat/history`（DELETE 一键清空）。
- 客户端 `src/lib/compute/cloud-threads.ts` + Chat 抽屉：云端可用时历史列表以服务端为准，条目标「云端」，流结束后整体上报一次（`pushKeyRef` 去重，避免流式过程重复写库）；抽屉底部显示同步状态与 Free 档升级提示。
- `src/app/settings/page.tsx` + `CloudHistorySettings`：明示「会存什么 / 绝不存什么」、当前档位保留期与条数、二次确认后硬删除。

**SQL 实测 7 项全通过**：客户端 uuid 建会话、批量写入、重复写入不翻倍、tsvector 检索命中、越权读不到、软删除后列表隐藏、硬删除级联清空消息。

## 六、立即要做的两件事（P0 已完成）

1. ✅ **修 `/ai/billing` 的 `HIGHLIGHTS`**：只写已实现的能力（额度），未实现项进「规划中」区块。
2. ✅ **修 `/api/health` 的 `aiGateway` 误报**（见下）。
   - `aiGateway` → `AI_GATEWAY_API_KEY`（真实推理通道）
   - `neonAiGateway` → `NEON_AI_GATEWAY_TOKEN`（备用，不影响免费模型）
   - `freeModels` → `FREE_MODELS_ENABLED` 熔断开关状态

---

## 八、模型广场/详情页改版（2026-10-16，对齐「不卖 API/Key」定位）

**用户诉求**：不卖 API 和 Key，只在网站内提供；详情页改成符合产品的样子，去掉无关内容。

\** ⚠️ 一个刻意没做的需求（需你确认）**：用户提到「某些模型要在 /chat 调用，需要买订阅」。  
若指「订阅解锁我们用 Gateway 跑付费模型」，这撞 AUP 红线（Vercel AUP 禁 sell access；  
AI Product Terms 许可仅限 personal or internal business use）——等于变相转售 token，  
与你此前拍定的「A. 卖产品能力，不转售 API key」冲突。**&#x56E0;此本次按合规版实现\*\*：

| 模型类型                       | 详情页 CTA                            | 说明                                       |
| -------------------------- | ---------------------------------- | ---------------------------------------- |
| 免费模型（`free` 标签或输入/输出单价为 0） | 「在 Chat 中对话」→ `/chat?model=<slug>` | 需签名登录，计入每日 token/次数配额；超限解法是接自己的 Key，不是升级 |
| 付费模型                       | 「配置自定义模型」→ `/ai/api-keys`          | Coolha 不代售算力；需接入用户自己的服务，费用由用户 Key 承担     |

**已删除/改述的内容**

- 删除「API 调用示例」（curl + `Authorization: Bearer $AI_GATEWAY_API_KEY`）—— 与「不卖 Key」直接矛盾，且 `AI_GATEWAY_BASE_URL` 导入一并移除
- 「在 Playground 中测试 / 打开 Playground」→ 「怎么在 Chat 里用」
- 「API 成本估算器」→ 「费用参考」，并明示这是**用你自己 Key** 的成本，不是 Coolha 收费
- 本页说明里删掉过时的「Playground 目前仍运行 Phase 1 演示模式（本地模拟回复）」
- 顺带清掉全站用户可见的「Playground」旧称（ai/usage、ai/api-keys、ConnectionsManager、ComputeNotes、ai/page 注释、chat/layout 注释）
- `ComputeNotes` 的产品边界段落重写：从「验证供需与交易闭环（模型聚合、统一 API、价格比较、在线测试）」改为「AI 对话工作台与软件能力；不转售算力或 Key」
- 删除已无引用的 `CopyButton.tsx`（原本只服务于 curl 示例）

**新增能力**：`/chat?model=<slug>` 预选模型（`PlaygroundChat` 挂载时读一次 URL，不随路由变化重置）。

**服务端口径同步**：`/api/compute/playground` 的 403 文案从「付费模型将在订阅制开放后提供」改为「该模型不在 Coolha 赞助额度内，请添加你自己的模型服务」。

**实测**（生产模式）：`/ai/models` 200、免费模型详情 200 且含「在 Chat 中对话」、付费模型详情 200 且含「配置自定义模型」、`/chat?model=<slug>` 200；页面已无 curl 示例与 Playground 字样。tsc 0、lint 0 errors、构建 EXIT=0。

**如果确实要做「订阅解锁付费模型」**，只有三条合规路径：(a) 服务端代理用户的 Key（P4，用户自带 key 由我们转发，属允许的 BYOK 软件层）；(b) 与上游签正式转售/Enterprise 协议；(c) 自部署开源模型。

## 十、AI Gateway 计划限制与数据政策（2026-10-16 核实）

### 10.1 Vercel 账号不开付费会员的真实影响

| 能力                           | 免费层（Hobby / 未购买 Credits）            | 付费层（购买 Credits 后）    |
| ---------------------------- | ----------------------------------- | -------------------- |
| 每月额度                         | **$5/月**，首次请求起算                     | Pay as you go，用多少扣多少 |
| 可用模型                         | 仅 **Free Tier eligible models** 子集  | 全目录                  |
| 单价                           | provider list price，**zero markup** | 同样 zero markup       |
| 限流                           | 每模型更低，超限返回 `429`                    | 可申请自定义限额             |
| BYOK                         | **不可用**                             | 可用                   |
| 团队级 ZDR / provider allowlist | 不可用（Pro+）                           | 可用（Pro+）             |

> 一次性购买 Credits 后即转入付费层，**每月 $5 免费额度同时失效**，但无续费承诺。

### 10.2 关键事实：免费语言模型 = 拿数据训练换的

实测当前目录（470 个模型，315 个 language）：

| 免费语言模型                               | 状态              | stealth | ZDR      | 不训练      |
| ------------------------------------ | --------------- | ------- | -------- | -------- |
| `nvidia/nemotron-3.5-lightning-free` | online          | 否       | **none** | **none** |
| `stealth/cat-jam`                    | online          | **是**   | none     | none     |
| `stealth/glyph-cluster`              | online          | **是**   | none     | none     |
| `poolside/laguna-s-2.1-free`         | **maintenance** | 否       | none     | none     |

**无一例外 `zdr=none` + `noTraining=none`** —— 免费额度是靠让供应商拿对话数据训练换来的。  
`convaiinnovations/laya`、`laya-free` 同为免费但 `zdr=none/noTrain=none`，且 gatewayType 是 `evaluation`，本就不在 Chat 列表。

反过来，全量 315 个 language 里有 **138 个 `ZDR=all` + `noTraining=all`**，最便宜的 `mistral/mistral-nemo` 输入 $0.029/M、\`openai/gpt-oss-20b\` $0.03/M。

### 10.3 因此改了赞助判据（重要架构变更）

**从「按价格 0 挑免费模型」改为「按数据政策挑可赞助模型」**：

```ts
isSponsorableModel(model) =
  !isStealthModel(model) &&
  model.zeroDataRetention === "all" &&
  model.noTraining === "all"
```

外加 `inputPricePerMillionUsd <= 1`（`SPONSORED_MAX_INPUT_PRICE_PER_MILLION`）防误配烧穿获客预算。  
实测筛出 **67 个**可用赞助模型，默认模型 `openai/gpt-oss-20b` 在列。

服务端硬门禁（`/api/compute/playground`）与 `getPlaygroundModels()` 同源，返回 `403 MODEL_NOT_SPONSORED`，  
并对「价格 0 但会训练」的模型给出专门文案。

> ⚠️ 连带修掉一个会**全量误杀**的 bug：`PlaygroundChat` 原先用 `models.filter(isFreeModel)` 做二次过滤，  
> 而赞助模型价格不为 0，会导致 Chat 模型下拉列表直接空掉。已改为直接用服务端筛好的集合。

### 10.4 已启用的防护

- **`disallowPromptTraining: true`**（per-request `providerOptions.gateway`，免费、全计划可用）：  
  只把请求路由给承诺不用数据训练的供应商，对 fallback 供应商同样生效。  
  不适用于 BYOK，但本路径只用系统凭证。
- **降级策略**：若某模型没有任何合规供应商（上游返回 `no_providers_available`），  
  自动重试一次不带过滤器，并在 `compute-meta.promptTrainingFiltered = false` 中标注，用量页可见。  
  环境变量 `AI_GATEWAY_DISALLOW_TRAINING=0` 可整体关闭（不建议）。
- **上游错误人性化**：额度耗尽 / 限流 / 凭证异常 / 超时分别给出可操作文案，不再一律「请稍后重试」。


### 10.5 你要做的事（Dashboard）

1. **购买 AI Gateway Credits**（最低额度即可）。这是解锁「全目录模型」的唯一前提——
   否则只能用 Free Tier 子集，而那批免费语言模型全部要拿数据训练。
   购买后 $5/月免费额度失效，但换来 138 个 ZDR + 不训练模型可选，67 个在 $1/M 以内。
2. **设 Budgets 上限**（AI Gateway → Budgets），按团队/项目/API key 封顶花费，防止失控。
3. **轮换本地 key**：`.env.local` 里的 `AI_GATEWAY_API_KEY` 已失效（实测 401），
   生产用的是 107 天前配的 Secret（无法回读核对）。若生产也失效，Chat 免费通道会整体报错。

### 10.6 成本测算（决定要不要心疼）

以最便宜的赞助模型估算（混合单价约 $0.05/M，Free 档 300K tokens/天上限）：

- 单个 Free 用户跑满配额 ≈ **$0.45/月**
- 100 个日活 Free 用户 ≈ $45/月

$5/月免费额度约够 11 个日活用户跑满；$10 额度约够 22 个。
按获客成本看待完全可控，且每日 token/次数双配额已经封顶。

### 10.7 仍未解决的合规义务

AI Product Terms §8.3：若提供与 AI Gateway 交互的 Application，**必须**向 End User
提供单独的 terms of use 与 privacy policy、**事先披露该 Application 使用 AI**、响应数据主体请求。
目前 `ButtonMenu` 链接到外部 `coolha.com/privacy`——需确认该页面已包含：
AI 使用披露、云端存什么（对话正文/模型标识/token 用量）、绝不存什么（API Key）、
保留期与一键清空入口、以及「免费通道由 Coolha 赞助、供应商承诺零数据保留」的表述。

## 十二、合规架构：怎么改才不触发红线 + 自建/开源网关选项

### 12.1 先精确定位红线（逐条对已核实条款）

| 我们的行为 | 判定 | 依据 |
|---|---|---|
| 提供 App 让终端用户走 AI Gateway | ✅ 不越线 | AI Product Terms **§8.3 专门规定了「Application」场景**并给客户设定义务——说明该用法被条款预见 |
| 赞助模型 genuinely 免费、登录即可用 | ✅ 不越线 | 同上 |
| **付费档位按 token 额度区分** | 🔴 **越线** | AUP 禁 "sell access / make Services available to any third party"；§2 许可仅限 personal or internal business use |
| Stealth 模型 | 🔴 越线（已修） | §8.2：无数据保护，第三方可训练 Inputs 并对 Output 主张 IP |
| BYOK 浏览器直连 | ✅ 不越线 | 用户自己的 key 与自己的合同，Vercel 完全不参与 |

**结论：红线不在「有免费模型」，在「按 token 数分档」。** 这是本次修复的核心。

### 12.2 已实施的修复：额度与档位彻底解耦

- `plans.ts` 删除 `PlanQuota` 接口与四档的 `quota` 字段；
  新增全局常量 `SPONSORED_DAILY_TOKENS = 300_000` / `SPONSORED_DAILY_REQUESTS = 30`。
- `quota.ts` 的 `checkQuota` 改用全局常量，`QuotaDecision` 增加 `dailyTokens` / `dailyRequests` 供错误提示。
- `/api/compute/playground` 的 429 文案明确「**所有档位额度相同，升级不会增加**」。
- `/api/wallet-auth/session` 不再回传档位相关额度。
- `SubscriptionPanel.HIGHLIGHTS` 删除全部「额度提升至 X」文案，改为纯软件能力；
  文件头加注释**严禁**再写 token 类卖点。
- 模型详情页徽章从「免费/付费模型」改为「零数据保留 · 不训练 / 不在赞助范围」。

改造后付费墙只卖：云端历史保留期、跨设备同步、全文检索、导出、连接数、编排、API 出口。
**用户付的钱买不到任何一丁点第三方模型算力。**

### 12.3 自建 / 开源 AI 网关选项（2026-10 核实）

| 网关 | 许可 | 运行时 | 适配度 | 风险 |
|---|---|---|---|---|
| **LiteLLM** | MIT 核心（`enterprise/` 单独收费） | Python | ⭐ 最成熟：140+ 供应商、虚拟 key、预算、成本追踪、fallback | ⚠️ **2026-03-24 PyPI 供应链投毒**（1.82.7/1.82.8 窃云凭证）→ 必须锁 commit hash + 验 Sigstore；Python 高并发下吞吐下降 |
| **Bifrost**（Maxim） | Apache-2.0 | Go | ⭐ 开销最低（~11µs P50 @5k RPS），单二进制 | 功能广度不如 LiteLLM |
| **Portkey** | MIT | Node/TS | fallback/重试/50+ guardrails 最强 | ⚠️ **2026-05-29 被 Palo Alto 收购**，self-hosted v2.0 仍 Pre-Release，仓库停更 |
| **Envoy AI Gateway** | Apache-2.0 | Go | K8s 原生 CRD，16 供应商 | 需已有 K8s；无语义缓存 |
| **Kong AI** | Apache-2.0 核心 | Lua | 已有 Kong 时的最顺路径 | 高级 AI 插件在 Enterprise |
| **Helicone** | **GPL-3.0** | Rust | 轻量 | ⚠️ Mintlify 收购后维护模式，仓库 2025-11 起停更 |
| OpenRouter | 闭源 | — | — | 抽 5.5%，请求过其服务器 |
| LLMGateway.io | AGPLv3 | — | — | 网络传染性，企业采购通常 disqualify |

**给 Coolha 的选型建议**：`LiteLLM`（要广度与虚拟 key/预算）或 `Bifrost`（要低开销单二进制）。
自建需要 Postgres + Redis + 一个常驻服务，运维量约 $25–500/月 + 值班。
**注意：自建网关移除的是 Vercel 条款，不移除上游供应商条款**——我们仍是自己 provider 账号的客户，
「免费 App + 统一额度 + 用户为软件付费」这个结构依然是唯一辩护依据。

### 12.4 三条可选路线

| 路线 | 做法 | 成本 | 合规强度 | 工作量 |
|---|---|---|---|---|
| **A. 留在 Vercel，买 Credits** | 已改完的架构 + 购买 Credits 解锁 ZDR 模型 | ~$0.45/用户/月 | 中（依赖 §8.3 抗辩） | 0 |
| **B. 自建网关 + 自有 provider key** | LiteLLM/Bifrost + 我们自己的 OpenAI/Anthropic key | infra $25–500/月 + token | 中高（Vercel 条款完全消失，可自定数据政策） | 2–4 周 |
| **C. 自部署开源模型** | `openai/gpt-oss-20b`（Apache 2.0）+ vLLM 跑在一张 GPU 上 | GPU 租用 ~$350–1500/月 | **最高**（数据不出我们的机器，零第三方条款） | 1–2 周 |

**推荐组合：A 立刻生效 → C 作为差异化**。`gpt-oss-20b` 开放权重、便宜、且我们已经确认它在
138 个 ZDR+不训练模型里。把它作为默认赞助模型自部署，配合「数据不出我们的机器」的叙事，
对 Web3 受众是最强的卖点；高峰期 fallback 到上游 ZDR 模型。

### 12.5 仍未闭环的合规义务

AI Product Terms §8.3 要求向 End User 提供单独 ToS + 隐私政策、**事先披露使用 AI**、响应数据主体请求。
当前 `ButtonMenu` 链到外部 `coolha.com/privacy`，需确认其包含：AI 使用披露、云端存什么
（对话正文/模型标识/token 用量）、绝不存什么（API Key）、保留期与一键清空入口、
「免费通道由 Coolha 赞助且供应商承诺零数据保留」的表述。

## 十三、待办（按优先级）

- [x] ~~**P0** 修正 billing 页 HIGHLIGHTS，避免宣传未实现能力~~ ✅
- [x] **P1** 会话历史上云（008 迁移 + 服务端强制保留期/条数）✅
- [ ] **P2** 跨设备同步的其余部分：连接元信息上云（密钥仍留本地或升级为服务端加密）
- [ ] **P3** 全文检索（已建好 `search_tsv` + GIN，`fullTextSearch` 尚未 gate）+ 导出（按 `exportScope` 分档）+ 到期数据的定期清理
- [ ] **P4** 服务端代理 BYOK（解锁路由策略 / 并排对比 / 成本看板 / API 出口），需先过合规确认
- [x] ~~**P5** 团队席位与组织模型~~ —— 2026-10-16 决定不做，字段已移除
