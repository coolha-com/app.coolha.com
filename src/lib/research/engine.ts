import { DIMENSION_BY_ID, RESEARCH_DIMENSIONS } from "./dimensions"
import { fetchContractFacts, fetchOnchainFacts, fetchTokenFacts } from "./sources"
import type {
  DimensionFinding,
  DimensionId,
  ExecutionStep,
  FindingSignal,
  ResearchReport,
  RiskLevel,
  TargetType,
} from "./types"

/**
 * 投前侦察引擎 —— 真实数据驱动。
 *
 * 铁律（不要假数据）：
 * 1. 所有展示的数值都来自真实数据源（Sourcify / Alchemy / DefiLlama）。
 * 2. 取不到数据 → 该维度标记 unavailable，summary 说明原因，**不生成任何数值或评分**。
 * 3. 不再有 0-100 风险分：评分精度无法由现有真实事实支撑，编造分数即假数据。
 *    改为「定性结论 + 依据说明（basis）」，让每个判断都可追溯到具体事实。
 */

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  critical: "极高风险",
}

const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2, critical: 3 }

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

function meta(id: DimensionId) {
  return DIMENSION_BY_ID[id]
}

/** 未取到数据时的维度（不给任何数值） */
function unavailable(id: DimensionId, reason: string): DimensionFinding {
  return {
    id,
    title: meta(id).title,
    status: "unavailable",
    riskLevel: null,
    summary: reason,
    signals: [],
    recommendations: [],
    dataSourceId: meta(id).dataSourceId,
    dataSourceLabel: meta(id).dataSourceLabel,
    live: meta(id).live,
    unavailableReason: reason,
  }
}

function live(
  id: DimensionId,
  riskLevel: RiskLevel,
  summary: string,
  signals: FindingSignal[],
  recommendations: string[],
  basis: string,
): DimensionFinding {
  return {
    id,
    title: meta(id).title,
    status: "live",
    riskLevel,
    summary,
    signals,
    recommendations,
    dataSourceId: meta(id).dataSourceId,
    dataSourceLabel: meta(id).dataSourceLabel,
    live: true,
    basis,
  }
}

/* ----------------------------- 各维度：真实数据 ----------------------------- */

async function buildContract(target: string): Promise<DimensionFinding> {
  const id: DimensionId = "contract"
  if (!ADDRESS_RE.test(target)) {
    return unavailable(id, "合约安全需要 0x 地址才能查证；你输入的是名称或符号，未取到任何合约事实。")
  }

  const facts = await fetchContractFacts(target)
  if (!facts) {
    return unavailable(
      id,
      "未取到合约事实（Alchemy 未配置，或 Sourcify 无该地址记录）。没有事实就不给结论。",
    )
  }
  if (!facts.isContract) {
    return unavailable(id, "该地址没有运行时字节码，不是合约（可能是普通钱包地址），没有合约代码可审查。")
  }

  const verified = facts.verified
  const signals: FindingSignal[] = [
    {
      label: "运行时字节码",
      value: facts.bytecodeBytes === null ? "未知" : `${facts.bytecodeBytes} bytes`,
      tone: "neutral",
    },
    {
      label: "源码验证（Sourcify）",
      value: verified === true ? "已验证开源" : verified === false ? "未验证" : "无记录",
      tone: verified === true ? "ok" : verified === false ? "bad" : "warn",
    },
  ]
  if (facts.verifiedAt) {
    signals.push({
      label: "验证时间",
      value: facts.verifiedAt.slice(0, 10),
      tone: "neutral",
    })
  }

  const riskLevel: RiskLevel =
    verified === true ? "low" : verified === false ? "high" : "medium"

  const summary =
    verified === true
      ? "合约源码已在 Sourcify 验证开源，链上字节码与公开源码一致，可自行核对实现。"
      : verified === false
        ? "合约源码未在 Sourcify 验证，无法核对链上代码的实际行为，交互风险显著升高。"
        : "Sourcify 没有该合约的验证记录，无法确认源码是否与链上字节码一致。"

  const recommendations =
    verified === true
      ? ["在 Sourcify / 区块浏览器核对源码后小额测试", "关注合约是否可升级（proxy）"]
      : ["未验证源码前不要转入主资金", "要求项目方提供验证源码或第三方审计", "仅用可亏损额度参与"]

  return live(
    id,
    riskLevel,
    summary,
    signals,
    recommendations,
    "依据：Sourcify 源码验证状态 + Alchemy 运行时字节码（真实抓取）",
  )
}

async function buildOnchain(target: string): Promise<DimensionFinding> {
  const id: DimensionId = "onchain"
  if (!ADDRESS_RE.test(target)) {
    return unavailable(id, "链上数据需要 0x 地址；你输入的是名称或符号，未取到任何链上事实。")
  }

  const facts = await fetchOnchainFacts(target)
  if (!facts) {
    return unavailable(
      id,
      "未取到链上数据（Alchemy 未配置或未响应）。活跃地址、资金净流入、鲸鱼动向需要 Alchemy 增强 API，当前未接入，因此不给任何数值。",
    )
  }

  const signals: FindingSignal[] = [
    {
      label: "当前 ETH 余额",
      value: facts.balanceEth === null ? "未知" : facts.balanceEth.toFixed(4),
      tone: "neutral",
    },
    {
      label: "累计发出交易数",
      value: facts.txCount === null ? "未知" : String(facts.txCount),
      tone: facts.txCount === 0 ? "warn" : "ok",
    },
  ]

  const riskLevel: RiskLevel = facts.txCount === 0 ? "medium" : "low"
  const summary =
    facts.txCount === 0
      ? "该地址尚未发出过任何交易，缺乏链上历史可供判断，建议谨慎。"
      : "已取到该地址的真实余额与交易数。注意：活跃地址趋势、资金净流入、鲸鱼动向需要更完整的数据源，当前未接入，本报告不作推测。"

  return live(
    id,
    riskLevel,
    summary,
    signals,
    ["把已取到的余额/交易数作为基础事实", "资金流与鲸鱼指标待接入 Alchemy 增强 API 后再评估"],
    "依据：Alchemy eth_getBalance / eth_getTransactionCount（真实抓取，仅 2 项事实，不足以全面评估）",
  )
}

async function buildToken(
  target: string,
  targetType: TargetType,
): Promise<DimensionFinding> {
  const id: DimensionId = "token"
  const facts = await fetchTokenFacts(target, targetType)
  if (!facts) {
    return unavailable(
      id,
      "DefiLlama 未收录该目标（未取到价格或 TVL）。市值、流动性深度、持仓集中度、解锁节奏都需要专门数据源，当前未接入，因此不给任何数值。",
    )
  }

  const signals: FindingSignal[] = []
  if (facts.symbol || facts.priceUsd !== null) {
    signals.push({
      label: "代币符号",
      value: facts.symbol ?? "未知",
      tone: "neutral",
    })
    signals.push({
      label: "现价（DefiLlama）",
      value: facts.priceUsd === null ? "未知" : `$${facts.priceUsd.toPrecision(6)}`,
      tone: "neutral",
    })
  }
  if (facts.protocolName || facts.protocolTvl !== null) {
    signals.push({
      label: "协议",
      value: facts.protocolName ?? "—",
      tone: "neutral",
    })
    signals.push({
      label: "TVL",
      value:
        facts.protocolTvl === null
          ? "未知"
          : `$${(facts.protocolTvl / 1e6).toFixed(2)}M`,
      tone: "neutral",
    })
  }

  return live(
    id,
    "low",
    "已取到 DefiLlama 的真实市场数据。注意：代币投资风险还需流动性深度、持仓集中度、解锁节奏等指标，这些数据源当前未接入，本报告只呈现已确认的事实，不作推测。",
    signals,
    ["结合已取到的真实价格/TVL 判断", "持仓集中度与解锁数据待接入后再评估"],
    "依据：DefiLlama coins/prices 或 protocol API（真实抓取）",
  )
}

function buildTeam(): DimensionFinding {
  const id: DimensionId = "team"
  return unavailable(
    id,
    "项目方 / 团队分析需要链上实体图谱与地址标签数据源（可做部署者聚类、scam 关联、多签占比）。该数据源当前未接入，任何「团队背景」结论都会是编造，因此本维度不给任何数值与判断。",
  )
}

function buildSentiment(): DimensionFinding {
  const id: DimensionId = "sentiment"
  return unavailable(
    id,
    "媒体热度 / 情绪分析需要社交聚合数据源（讨论量、情绪极性、刷量检测）。该数据源当前未接入，任何热度或极性数值都会是编造，因此本维度不给任何数值与判断。",
  )
}

/* ----------------------------- 执行步骤草稿 ----------------------------- */

function buildExecutionPlan(targetType: TargetType, target: string): ExecutionStep[] {
  const common: ExecutionStep[] = [
    {
      order: 1,
      action: "连接钱包并确认网络",
      detail: "使用 Reown 连接你的钱包，确认当前网络与目标合约所在链一致。服务端不托管任何私钥。",
      riskLevel: "low",
      requiresSignature: false,
    },
    {
      order: 2,
      action: "小额试探性交互",
      detail: `先用极小金额（例如 $1 等值）与 ${target} 交互一次，验证合约行为符合预期，再决定是否加大。`,
      riskLevel: "low",
      requiresSignature: true,
    },
  ]

  const byType: Record<TargetType, ExecutionStep[]> = {
    token: [
      {
        order: 3,
        action: "在 DEX 授权代币（限制额度）",
        detail: "仅授权本次兑换所需额度，不要使用「无限授权」。授权是链上操作，需你本人签名。",
        riskLevel: "medium",
        requiresSignature: true,
      },
      {
        order: 4,
        action: "执行兑换并设置 slippage",
        detail: "设置合理滑点（建议 0.5%–1%），核对预计到账与价格影响，确认无误后签名。",
        riskLevel: "medium",
        requiresSignature: true,
      },
      {
        order: 5,
        action: "设置止盈 / 止损提醒",
        detail: "把该仓位加入监控，按报告里的风险结论设定撤离触发条件。",
        riskLevel: "low",
        requiresSignature: false,
      },
    ],
    contract: [
      {
        order: 3,
        action: "审阅目标方法参数",
        detail: "在发起前核对合约方法名与入参，避免误调高危函数（如 setOwner / mint）。",
        riskLevel: "medium",
        requiresSignature: false,
      },
      {
        order: 4,
        action: "发起受控签名",
        detail: "AI 仅生成交易草稿并展示预估 gas 与影响，真正签名由你的钱包完成。",
        riskLevel: "medium",
        requiresSignature: true,
      },
    ],
    project: [
      {
        order: 3,
        action: "查看官方渠道与合约清单",
        detail: "从项目官方渠道核对本次要交互的合约地址，提防同名仿盘。",
        riskLevel: "medium",
        requiresSignature: false,
      },
      {
        order: 4,
        action: "生成交互草稿",
        detail: "AI 将本次操作拆成可逐步签名的草稿，每一步都先展示再请求签名。",
        riskLevel: "medium",
        requiresSignature: true,
      },
    ],
  }

  return [...common, ...byType[targetType]]
}

/* ----------------------------- 报告生成 ----------------------------- */

/**
 * 生成投前侦察报告（真实数据驱动）。
 * 必须在服务端调用：Alchemy 密钥只在服务端读取。
 */
export async function generateResearchReport(
  target: string,
  selected: DimensionId[],
  targetType: TargetType,
): Promise<ResearchReport> {
  const ids = selected.length > 0 ? selected : RESEARCH_DIMENSIONS.map((d) => d.id)
  const trimmed = target.trim()

  const builders: Record<DimensionId, () => Promise<DimensionFinding>> = {
    contract: () => buildContract(trimmed),
    onchain: () => buildOnchain(trimmed),
    token: () => buildToken(trimmed, targetType),
    team: async () => buildTeam(),
    sentiment: async () => buildSentiment(),
  }

  const dimensions = await Promise.all(ids.map((id) => builders[id]()))

  const liveDims = dimensions.filter((d) => d.status === "live")
  const unavailableDims = dimensions.filter((d) => d.status === "unavailable")

  const overallRisk =
    liveDims.length === 0
      ? null
      : liveDims.reduce<RiskLevel>(
          (worst, d) => (d.riskLevel && RISK_ORDER[d.riskLevel] > RISK_ORDER[worst] ? d.riskLevel : worst),
          "low",
        )

  const verdict = buildVerdict(trimmed, liveDims.length, unavailableDims.length, overallRisk)

  return {
    target: trimmed,
    targetType,
    createdAt: new Date().toISOString(),
    overallRisk,
    verdict,
    dimensions,
    executionPlan: buildExecutionPlan(targetType, trimmed),
    liveCount: liveDims.length,
    unavailableCount: unavailableDims.length,
  }
}

function buildVerdict(
  target: string,
  liveCount: number,
  unavailableCount: number,
  overallRisk: RiskLevel | null,
): string {
  if (liveCount === 0) {
    return `本次对 ${target} 的侦察**没有取到任何真实数据**（数据源未接入或目标未被收录），因此不给出任何结论——不做无依据的推测。请检查数据源配置，或换用 DefiLlama 收录的目标。`
  }
  const riskText = overallRisk ? RISK_LABEL[overallRisk] : "无结论"
  const tail =
    unavailableCount > 0
      ? `另有 ${unavailableCount} 个维度的数据源未接入，这些维度**不给任何数值与判断**。`
      : "所选维度均已取到真实数据。"
  return `对 ${target} 的侦察基于 ${liveCount} 个数据源的真实事实，综合定性为「${riskText}」。${tail}报告只呈现已确认的事实，未接入的部分不做推测。`
}

export { RISK_LABEL }
