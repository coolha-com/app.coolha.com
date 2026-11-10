import { WEB3_TOOLS } from "@/lib/web3-tools/catalog"
import type { DimensionId, ResearchReport, TargetType } from "@/lib/research/types"

/** 第一期唯一托管服务。 */
export const RWA_SERVICE_ID = "rwa-research"

/**
 * 付款缺口说明（操作事实，不是新的法律口径）。
 * 现有匹配函数 settleWithTransfer 会 grantPlan，不能直接拿来结算本服务。
 */
export const PAYMENT_GAP =
  "这笔订单没有标价，也没有链上结算。现有 USDC/USDT 订单匹配只写入 subscription_orders，命中后会开通 Plus / Pro / Ultra 订阅，不能用来给这项研究服务入账。因此付款状态保持「未付款」。"

export const RWA_COMMERCIAL = {
  serviceName: "RWA Research",
  listPriceUsd: null,
  priceCurrency: "USD" as const,
  paymentStatus: "unpaid" as const,
  settlement: "not_wired" as const,
  gap: PAYMENT_GAP,
}

/** 研究管线里依赖 Alchemy 读链的维度。工具目录里目前只有这一条 live。 */
const ALCHEMY_TOOL_ID = "alchemy-mcp-server"

export interface ConnectedToolOption {
  id: string
  name: string
  liveScope: string
}

/** 只返回目录里真正 live、且只读的工具。未接入的条目不会出现。 */
export function listConnectedReadTools(): ConnectedToolOption[] {
  return WEB3_TOOLS.filter((tool) => tool.integration === "live" && tool.risk === "read").map(
    (tool) => ({
      id: tool.id,
      name: tool.name,
      liveScope: tool.liveScope ?? "",
    }),
  )
}

export function dimensionsForAllowedTools(allowed: readonly string[]): DimensionId[] {
  const dimensions: DimensionId[] = []
  if (allowed.includes(ALCHEMY_TOOL_ID)) {
    dimensions.push("contract", "onchain")
  }
  dimensions.push("token", "team", "sentiment")
  return dimensions
}

export interface TaskConstraints {
  readOnly: boolean
  citeSources: boolean
  unverifiedNotFact: boolean
}

export function constraintsAccepted(value: TaskConstraints): boolean {
  return value.readOnly === true && value.citeSources === true && value.unverifiedNotFact === true
}

const SECRET_KEY = /api[-_]?key|authorization|secret|password|bearer|base[-_]?url|private[-_]?key/i
const SECRET_VALUE = /(?:sk-[A-Za-z0-9]{8,}|Bearer\s+\S{8,}|api[_-]?key\s*[:=]\s*\S+)/i

export function findSecretKey(value: unknown): string | null {
  if (!value || typeof value !== "object") return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSecretKey(item)
      if (found) return found
    }
    return null
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) return key
    const nested = findSecretKey(child)
    if (nested) return nested
  }
  return null
}

export function containsSecretValue(text: string): boolean {
  return SECRET_VALUE.test(text)
}

export type ModelMode = "sponsored" | "byok"

export interface ProfileInput {
  modelMode: ModelMode
  sponsoredModelSlug: string | null
  byokConnectionId: string | null
  byokModelLabel: string | null
  allowedToolIds: string[]
  constraints: TaskConstraints
}

const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,160}$/
const CONNECTION_ID_RE = /^[A-Za-z0-9_-]{8,80}$/

export function normalizeAllowedTools(ids: unknown): string[] | null {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) return null
  const live = new Set(listConnectedReadTools().map((tool) => tool.id))
  const unique = [...new Set(ids)]
  if (unique.some((id) => !live.has(id))) return null
  return unique
}

export function parseProfileInput(body: unknown): ProfileInput | { error: string } {
  if (!body || typeof body !== "object") return { error: "请求体不是合法 JSON" }
  if (findSecretKey(body)) return { error: "Profile 不能包含密钥字段" }

  const record = body as Record<string, unknown>
  const modelMode = record.modelMode
  if (modelMode !== "sponsored" && modelMode !== "byok") {
    return { error: "模型只能选择平台赞助模型或浏览器内 BYOK" }
  }

  const constraintsRaw = record.constraints
  if (!constraintsRaw || typeof constraintsRaw !== "object") {
    return { error: "请确认任务约束" }
  }
  const constraints = constraintsRaw as Record<string, unknown>
  const parsedConstraints: TaskConstraints = {
    readOnly: constraints.readOnly === true,
    citeSources: constraints.citeSources === true,
    unverifiedNotFact: constraints.unverifiedNotFact === true,
  }
  if (!constraintsAccepted(parsedConstraints)) {
    return { error: "这项服务只在「只读、必须标注来源、不得把未验证信息当事实」都打开时保存" }
  }

  const allowedToolIds = normalizeAllowedTools(record.allowedToolIds)
  if (!allowedToolIds) return { error: "工具只能从已接入的只读工具里选择" }

  if (modelMode === "sponsored") {
    const slug = typeof record.sponsoredModelSlug === "string" ? record.sponsoredModelSlug.trim() : ""
    if (!SLUG_RE.test(slug)) return { error: "请选择一个平台赞助模型" }
    return {
      modelMode,
      sponsoredModelSlug: slug,
      byokConnectionId: null,
      byokModelLabel: null,
      allowedToolIds,
      constraints: parsedConstraints,
    }
  }

  const connectionId =
    typeof record.byokConnectionId === "string" ? record.byokConnectionId.trim() : ""
  const modelLabel = typeof record.byokModelLabel === "string" ? record.byokModelLabel.trim() : ""
  if (!CONNECTION_ID_RE.test(connectionId)) return { error: "请选择这台浏览器里的一个 BYOK 连接" }
  if (modelLabel.length < 1 || modelLabel.length > 80 || containsSecretValue(modelLabel)) {
    return { error: "请选择 BYOK 连接上的模型名称，不要填写密钥" }
  }

  return {
    modelMode,
    sponsoredModelSlug: null,
    byokConnectionId: connectionId,
    byokModelLabel: modelLabel,
    allowedToolIds,
    constraints: parsedConstraints,
  }
}

export function isTargetType(value: unknown): value is TargetType {
  return value === "contract" || value === "token" || value === "project"
}

const ADDRESS_RE = /0x[a-fA-F0-9]{40}/

export function parseResearchTask(
  task: string,
  targetType: TargetType,
): { target: string; targetType: TargetType } {
  const address = task.match(ADDRESS_RE)?.[0] ?? null
  if (address && targetType === "project") {
    return { target: address, targetType: "contract" }
  }
  if (address) return { target: address, targetType }
  return { target: task.trim().slice(0, 200), targetType }
}

/** 落库的报告：去掉会建议签名/兑换的执行草稿。 */
export type StoredResearchReport = Omit<ResearchReport, "executionPlan">

export function toStoredReport(report: ResearchReport): StoredResearchReport {
  return {
    target: report.target,
    targetType: report.targetType,
    createdAt: report.createdAt,
    overallRisk: report.overallRisk,
    verdict: report.verdict,
    dimensions: report.dimensions,
    liveCount: report.liveCount,
    unavailableCount: report.unavailableCount,
    disclaimer: report.disclaimer,
  }
}

export interface ProfileSnapshot {
  modelMode: ModelMode
  sponsoredModelSlug: string | null
  byokConnectionId: string | null
  byokModelLabel: string | null
  allowedToolIds: string[]
  excludedToolIds: string[]
  dimensions: DimensionId[]
  constraints: TaskConstraints
}

export function snapshotFromProfile(input: ProfileInput): ProfileSnapshot {
  const liveIds = listConnectedReadTools().map((tool) => tool.id)
  return {
    modelMode: input.modelMode,
    sponsoredModelSlug: input.sponsoredModelSlug,
    byokConnectionId: input.byokConnectionId,
    byokModelLabel: input.byokModelLabel,
    allowedToolIds: input.allowedToolIds,
    excludedToolIds: liveIds.filter((id) => !input.allowedToolIds.includes(id)),
    dimensions: dimensionsForAllowedTools(input.allowedToolIds),
    constraints: input.constraints,
  }
}

export interface SavedProfile extends ProfileInput {
  excludedToolIds: string[]
  updatedAt: string
}

export interface ResearchRunView {
  orderId: string
  executionId: string
  taskText: string
  target: string
  targetType: TargetType
  createdAt: string
  finishedAt: string | null
  status: "running" | "succeeded" | "failed"
  channel: string
  geoTier: string | null
  paymentStatus: "unpaid"
  settlement: "not_wired"
  listPriceUsd: null
  priceCurrency: "USD"
  report: StoredResearchReport | null
  narrative: string | null
  narrativeSource: "none" | "sponsored" | "byok_browser" | null
  narrativeNote: string | null
  errorMessage: string | null
  profileSnapshot: ProfileSnapshot
}
