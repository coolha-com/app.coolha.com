/**
 * 投前侦察（Pre-Investment Recon）领域模型。
 *
 * 数据诚实纪律：
 * - 报告只呈现**真实抓取到**的链上/市场事实（Sourcify、Alchemy、DefiLlama）。
 * - 拿不到数据的维度一律标记为 `unavailable`，**不生成任何风险分或指标数值**，
 *   绝不用随机数、模板或「看起来合理」的默认值填充。
 * - 综合分仅由 `live` 维度推导；一个 live 维度都没有时，综合分与结论为 null。
 */

export type TargetType = "contract" | "token" | "project"

export type RiskLevel = "low" | "medium" | "high" | "critical"

export type SignalTone = "ok" | "warn" | "bad" | "neutral"

/** 维度状态：live = 本次真的拿到了真实数据；unavailable = 没拿到（不给数字） */
export type DimensionStatus = "live" | "unavailable"

export type DimensionId =
  | "contract" // 智能合约安全
  | "team" // 项目方 / 团队分析
  | "token" // 代币投资风险
  | "onchain" // 链上数据投资研究
  | "sentiment" // 媒体热度 / 情绪分析

/** 单条侦察信号：报告卡里以「标签 + 数值」形式呈现 */
export interface FindingSignal {
  label: string
  value: string
  tone: SignalTone
}

/** 单个维度的侦察结论 */
export interface DimensionFinding {
  id: DimensionId
  title: string
  /** live = 真实数据；unavailable = 数据源未接入或未取到，无任何数值 */
  status: DimensionStatus
  /** unavailable 时为 null */
  riskLevel: RiskLevel | null
  summary: string
  /** unavailable 时为空数组 */
  signals: FindingSignal[]
  recommendations: string[]
  /** 该维度由哪个真实数据源驱动 */
  dataSourceId: string
  dataSourceLabel: string
  /** 是否已有真实数据源接入（能力层面，区别于本次是否取到） */
  live: boolean
  /** unavailable 的原因，UI 直接展示 */
  unavailableReason?: string
  /** live 时说明分数依据（可解释性） */
  basis?: string
}

/** 执行步骤：用户决定「要执行」后，AI 给出的逐步操作草稿 */
export interface ExecutionStep {
  order: number
  action: string
  detail: string
  riskLevel: RiskLevel
  requiresSignature: boolean
}

/** 一份完整的投前侦察报告 */
export interface ResearchReport {
  target: string
  targetType: TargetType
  createdAt: string
  /** 无 live 维度时为 null */
  overallRisk: RiskLevel | null
  verdict: string
  dimensions: DimensionFinding[]
  /** 用户决定执行时由 AI 生成的步骤草稿（服务端不持钥，先出草稿再签名） */
  executionPlan: ExecutionStep[]
  /** 本次真正取到真实数据的维度数 */
  liveCount: number
  /** 未取到数据（未接入/抓取失败）的维度数 */
  unavailableCount: number
}
