# AI Gateway 模型目录接入说明

`/ai/models` 与外部接口 `/api/v1/models` 的数据来自 **Vercel AI Gateway** 的 OpenAI 兼容端点：

```
GET {AI_GATEWAY_BASE_URL}/models        # 默认 https://ai-gateway.vercel.sh/v1/models
Authorization: Bearer ${AI_GATEWAY_API_KEY}
```

实测（2026-10-15）：返回 **464 个模型**，覆盖 `anthropic` / `openai` / `google` / `alibaba` 等 47 家供应商，
类型含 `language` / `embedding` / `image` / `video` / `speech` / `transcription` / `reranking` / `realtime` / `evaluation`。

## 数据流

```
AI Gateway /v1/models
   └─ src/lib/ai-gateway/client.ts     服务端拉取（持有 Key，1h 缓存，失败降级演示目录）
        └─ src/lib/ai-gateway/normalize.ts   归一化成 ComputeModel
             ├─ src/app/(APP)/ai/models/page.tsx        列表页（RSC，revalidate 3600）
             ├─ src/app/(APP)/ai/models/[id]/page.tsx   详情页（slug 寻址）
             └─ src/app/api/v1/models/*                 公开只读 JSON 接口
```

## 环境变量

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `AI_GATEWAY_API_KEY` | 是 | Vercel AI Gateway Key（`vck_` 前缀）。**仅服务端读取，绝不下发浏览器** |
| `AI_GATEWAY_BASE_URL` | 否 | 默认 `https://ai-gateway.vercel.sh/v1` |
| `CATALOG_REFRESH_TOKEN` | 否 | 设置后，`/api/v1/models?refresh=1&token=<该值>` 可跳过缓存强制回源；未设置时 `refresh` 被忽略 |

## 缓存与降级

- 上游请求带 `next.revalidate = 3600` + tag `ai-gateway-models`，页面与接口同步 1 小时缓存。
- 上游失败 / 未配置 Key 时自动回退到 Phase 1 演示目录，并在响应中标记 `source: "demo"`、`stale: true`，
  UI 打出「示例数据」提示——**演示数据不会被伪装成真实数据**。

## 公开接口

### `GET /api/v1/models`

| 参数 | 说明 |
| --- | --- |
| `q` | 关键词（名称 / 模型 ID / 供应商 / 简介） |
| `provider` | 供应商 ID，如 `anthropic` |
| `type` | `chat` / `embedding` / `image` / `video` / `audio` / `reranking` / `realtime` / `evaluation` |
| `capability` | `streaming` / `vision` / `tools` / `json-mode` / `function-calling` |
| `maxPrice` | 输入价格上限（USD / 百万 tokens） |
| `sort` | `name-asc` / `price-asc` / `price-desc` / `output-price-asc` / `output-price-desc` / `latency-asc` / `context-desc` / `context-asc` |
| `limit` | 默认 100，最大 500 |
| `offset` | 默认 0 |
| `refresh` + `token` | 强制回源（需 `CATALOG_REFRESH_TOKEN`） |

响应：

```json
{
  "object": "list",
  "source": "ai-gateway",
  "stale": false,
  "fetchedAt": "2026-10-15T00:00:00.000Z",
  "total": 464,
  "count": 20,
  "offset": 0,
  "limit": 20,
  "providers": [{ "id": "anthropic", "name": "Anthropic", "dataSource": "provider-reported" }],
  "data": [{ "id": "anthropic-claude-sonnet-4-5", "modelId": "anthropic/claude-sonnet-4.5", "...": "..." }]
}
```

### `GET /api/v1/models/[slug]`

slug 由模型 ID 推导：`anthropic/claude-sonnet-4.5` → `anthropic-claude-sonnet-4-5`。
未命中返回 `404 {"error":{"code":"MODEL_NOT_FOUND"}}`。

## 字段映射（上游 → 站内）

| 上游字段 | 站内字段 | 备注 |
| --- | --- | --- |
| `id` | `modelId` / `gatewayModelId` | 可直接用于网关调用 |
| `owned_by` | `providerId` / `providerSlug` | 展示名走 `PROVIDER_LABELS` 映射 |
| `type` | `type` | language→chat，speech/transcription→audio，其余同名 |
| `pricing.input/output` | `inputPricePerMillionUsd` / `outputPricePerMillionUsd` | 上游为「每 token USD」字符串，×1e6 换算 |
| `pricing.input_cache_read` | `cachedInputPricePerMillionUsd` | |
| `pricing.varies_by_provider` | `priceVariesByProvider` | UI 提示「价格随供应商浮动」 |
| `context_window` / `max_tokens` | `contextLength` / `maxOutputTokens` | 缺失记 0，UI 显示「—」 |
| `tags` / `supported_parameters` / `modalities` | `capabilities` | 见 `detectCapabilities()` |
| `deprecated_at` | `status = "maintenance"` | 列表默认隐藏 |
| — | `latencyMs` | 上游不提供，恒为 `null`，**不臆造延迟** |
| — | `dataSource` | 真实目录恒为 `provider-reported` |

## Playground 真实推理（/ai/playground）

- 路由 `POST /api/compute/playground`：AI SDK `createGateway({ apiKey })` + `streamText`，
  服务端持有 `AI_GATEWAY_API_KEY`，浏览器不接触上游密钥。
- **默认模型 `nvidia/nemotron-3.5-lightning-free`**（上游标注免费，实测 `cost = 0`），
  Playground 对访问者开放，默认模型必须零成本。模型下拉按「免费 / 按量计费」分组，
  免费徽章由 `isFreeModel()` 判定（free 标签或输入输出价均为 0）。
- 仅允许 `gatewayType === "language"` 的模型；其余返回 400 `UNSUPPORTED_MODEL_TYPE`。
- `sendReasoning: true`：nemotron 等推理模型把思考过程放在 reasoning 分片，UI 折叠展示。
- meta（`data-compute-meta`）回传真实数据：`inputTokens` / `outputTokens` / `costUsd`
  （取自上游 `providerMetadata.gateway.cost`）/ `generationId` / `resolvedProvider`；
  上游未回传 cost 时按目录单价线性估算并置 `estimated: true`。
- 兜底防护：进程内滑动窗口限流（60s / 20 次）、256KB 请求体上限、地理硬屏蔽二次校验。

## 用量记录（/ai/usage）

- 迁移 `db/migrations/003_ai_gateway_usage.sql` 建表 `ai_gateway_usage`，
  每次 Playground 调用结束后异步落库（失败不影响响应）。
  执行方式：`node scripts/apply-migration.mjs db/migrations/003_ai_gateway_usage.sql`
- 页面 `force-dynamic`，展示累计调用 / Token / 成本 + 最近 50 条明细；
  无真实数据时回退示例行并打「示例数据」标识。

## 列表页交互（/ai/models）

- **表头排序**：「上下文 / 输入 / 百万 / 输出 / 百万」三列可点击切换升序↔降序，
  箭头指示当前方向，带 `aria-sort`。切换逻辑见 `nextSortForColumn()`（`src/lib/compute/service.ts`）。
- **筛选下拉**（`src/components/compute/FilterSelect.tsx`）：基于 Base UI `Select` 自定义，
  `<option>` 无法渲染 Logo 故不用原生 `<select>`。供应商选项带本地 Logo，
  模型类型 / 能力 / 价格 / 排序选项带图标，选中态回显到触发器。
- **能力悬浮展开**（`src/components/compute/CapabilityPopover.tsx`）：默认显示前 3 个能力标签，
  悬浮（180ms 延迟）或键盘聚焦展开完整清单 + 每条说明 + 输入输出模态。
  用 Portal 渲染浮层——表格容器 `overflow-x-auto` 会裁切普通绝对定位。
- 列表行与卡片保持一致的详情入口：收藏星标 + 「详情 →」。

## 供应商 Logo

- `scripts/fetch-provider-logos.mjs` 抓取 `public/logos/providers/`（45/47 家，
  优先 Vercel 官方展示 PNG，缺失回退 models.dev SVG），并生成
  `src/lib/ai-gateway/provider-logos.generated.ts` 供运行时直接 import。
- 注意：models.dev 对未知 provider 也返回 200（1421 字节占位图），必须按文件大小排除。
- `convaiinnovations` / `inclusionai` 无官方 Logo，UI 回退首字母标识块。

## 合规边界

- 本模块只做**目录与价格展示** + **自有应用的模型体验**，不提供 token 中转、代调用或转售；
  Playground 与详情页的 curl 示例直连上游官方端点并使用调用方自己的 Key。
- `/api/` 前缀受 `proxy.ts` 地理合规拦截影响（硬屏蔽地区返回 451），对外集成前需确认目标区域。
