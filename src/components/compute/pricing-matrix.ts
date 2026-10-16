/**
 * 订阅页的文案与权益对照矩阵（同构：服务端渲染与客户端交互共用）。
 * 禁止在此引入 server-only 依赖或环境变量。
 *
 * ⚠️ 文案红线（与 lib/compute/plans.ts 一致）：
 * 付费只能卖 Coolha 的软件能力，**不得出现任何 token 额度 / 免费模型数量差异**。
 * 免费对话额度对全体登录用户统一（SPONSORED_DAILY_TOKENS / SPONSORED_DAILY_REQUESTS），
 * 因此矩阵里「免费模型对话」一行四档完全相同，这是刻意呈现，不是遗漏。
 */

/**
 * **尚未落地**的能力：明确标注规划中，不作为卖点售卖。
 *
 * ⚠️ 维护纪律：这份列表必须与 `docs/ENTITLEMENT_ENFORCEMENT_STATUS.md` 一致。
 * 2026-10-16 复核时发现这里曾写着「服务端会话历史与跨设备同步」「历史全文检索与批量导出」
 * 标为规划中，但 008 迁移已把它们实现并真正强制（`authorizeHistory()` + `search_tsv` GIN）——
 * 已实现的能力不能继续挂在规划里，否则要么白送，要么变成卖空气。
 * 真正没有执行点的只有下面这两项。
 */
export const ROADMAP: string[] = [
  "多模型并排对比",
  "路由策略（fallback / 重试 / 成本上限）",
]

export type MatrixRowId =
  | "sponsored"
  | "byok"
  | "historyDays"
  | "historyThreads"
  | "sync"
  | "search"
  | "export"
  | "personas"
  | "templates"
  | "compare"
  | "routing"
  | "dashboard"
  | "api"

interface MatrixRow {
  id: MatrixRowId
  label: string
  /** 该行是否属于「四档完全相同」的统一项 */
  uniform?: boolean
}

/**
 * 是否已有真正的服务端执行点（`docs/ENTITLEMENT_ENFORCEMENT_STATUS.md` 的复核结论）。
 *
 * 定价页陈列的是**承诺**。纸面配置出现在承诺表里就是在卖空气，
 * 所以未兑现的行必须显示「规划中」而不是 ✓ / 数字。逐条对应强制点：
 *
 * - `sponsored` → `src/lib/neon/quota.ts`（每日 token + 次数，真实 401/403）
 * - `historyDays` / `historyThreads` / `sync` / `search` → `src/lib/neon/chat-history.ts`
 *   的 `authorizeHistory()`（Free 严格 0 云历史，付费墙真实生效）
 * - `export` / `costDashboardDays` → 随历史授权一并生效
 *
 * 以下**均无执行点**，仅为纸面字段：
 * - `byokConnections`：连接存在浏览器本地，服务端无法可靠计数
 * - `personas` / `promptTemplates`：产品内暂无这两个功能入口
 * - `parallelCompare` / `routingPolicies`：功能本身未实现
 * - `apiAccess`：API 出口尚未上线
 */
export const PENDING_ROWS: ReadonlySet<MatrixRowId> = new Set<MatrixRowId>([
  "byok",
  "personas",
  "templates",
  "compare",
  "routing",
  "api",
])

export const MATRIX_ROWS: MatrixRow[] = [
  { id: "sponsored", label: "免费模型对话", uniform: true },
  { id: "byok", label: "自定义模型连接" },
  { id: "historyDays", label: "云端历史保留" },
  { id: "historyThreads", label: "云端历史条数" },
  { id: "sync", label: "跨设备同步" },
  { id: "search", label: "历史全文检索" },
  { id: "export", label: "导出范围" },
  { id: "personas", label: "Persona 预设" },
  { id: "templates", label: "Prompt 模板" },
  { id: "compare", label: "多模型并排对比" },
  { id: "routing", label: "路由策略" },
  { id: "dashboard", label: "成本看板回看" },
  { id: "api", label: "API / MCP 出口" },
]

export const PENDING_TEXT = "规划中"

const DASH = "—"
const CHECK = "✓"

const INFINITE = "无限"

function days(value: number | null): string {
  if (value === 0) return "不提供"
  if (value === null) return "永久"
  return `${value} 天`
}

function count(value: number | null): string {
  if (value === null) return INFINITE
  return value.toLocaleString("en-US")
}

/**
 * 权益矩阵单元格取值。纯函数：输入是档位定义 + 行 id，输出是展示字符串。
 * 「统一项」四档返回同一字符串，用来把「全档位相同」这件事显式讲出来。
 */
export function matrixCell(
  limits: {
    byokConnections: number | null
    historyDays: number | null
    historyThreads: number | null
    crossDeviceSync: boolean
    fullTextSearch: boolean
    exportScope: "none" | "single" | "batch" | "scheduled"
    personas: number | null
    promptTemplates: number | null
    parallelCompare: number
    routingPolicies: boolean
    costDashboardDays: number | null
    apiAccess: boolean
  },
  row: MatrixRowId,
  sponsoredLabel: string,
): string {
  switch (row) {
    case "sponsored":
      return sponsoredLabel
    case "byok":
      return limits.byokConnections === null ? INFINITE : String(limits.byokConnections)
    case "historyDays":
      return days(limits.historyDays)
    case "historyThreads":
      return limits.historyDays === 0 ? DASH : count(limits.historyThreads)
    case "sync":
      return limits.crossDeviceSync ? CHECK : DASH
    case "search":
      return limits.fullTextSearch ? CHECK : DASH
    case "export": {
      switch (limits.exportScope) {
        case "none":
          return DASH
        case "single":
          return "单条"
        case "batch":
          return "批量"
        case "scheduled":
          return "定时"
      }
      return DASH
    }
    case "personas":
      return limits.personas === null ? INFINITE : String(limits.personas)
    case "templates":
      return limits.promptTemplates === null ? INFINITE : String(limits.promptTemplates)
    case "compare":
      return limits.parallelCompare === 0 ? DASH : `${limits.parallelCompare} 路`
    case "routing":
      return limits.routingPolicies ? CHECK : DASH
    case "dashboard":
      return limits.costDashboardDays === 0 ? DASH : days(limits.costDashboardDays)
    case "api":
      return limits.apiAccess ? CHECK : DASH
  }
}