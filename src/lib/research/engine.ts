import { DIMENSION_BY_ID, RESEARCH_DIMENSIONS } from "./dimensions"
import { REPORT_DISCLAIMER, RISK_LABEL } from "./labels"
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

/**
 * 构造一个 live 维度结论。
 *
 * ⚠️ `riskLevel` 允许为 `null` —— **「取到了真实数据但无法定级」是一种正常状态**，
 * 不能强制回落成 `low`（那是假安全感）或 `medium`（那是假异常）。
 * 典型场景：`onchain` 的地址从未发过交易、`token` 的核心指标未接入。
 */
function live(
  id: DimensionId,
  riskLevel: RiskLevel | null,
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
      // ⛔ 四态必须说四句不同的话 —— 「未验证」与「查不到」不可混为一谈
      value:
        verified === true
          ? "已验证开源"
          : verified === false
            ? "有验证记录但与链上字节码不匹配"
            : verified === "not-found"
              ? "无验证记录"
              : "未知（验证状态取数失败）",
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

  // ⛔ 只有 `false`（有记录但不匹配）是明确的负面事实，才可定级为「发现明确异常」。
  // 「not-found」（确认无记录）与 `null`（取数失败）都是**无法判定** → null。
  // 缺失 ≠ 异常。
  const riskLevel: RiskLevel | null =
    verified === true ? "low" : verified === false ? "high" : null

  const summary =
    verified === true
      ? "合约源码已在 Sourcify 验证开源，链上字节码与公开源码一致，可自行核对实现。"
      : verified === false
        ? "Sourcify 有该合约的验证记录，但记录与链上字节码不匹配，无法据此核对链上代码的实际行为。"
        : verified === "not-found"
          ? "Sourcify 没有该合约的验证记录。这是确定结论（上游确认无记录），不等于源码有问题。代币流动性深度、持仓集中度、解锁节奏、部署者与团队背景均需其他数据源，当前未接入，不作判断。"
          : "本次未能取到 Sourcify 的验证状态（数据源不可用或返回了未知格式），无法判定源码是否与链上字节码一致。代币流动性深度、持仓集中度、解锁节奏、部署者与团队背景均需其他数据源，当前未接入，不作判断。"

  // ⛔ 行动建议只给**技术核实路径**，不给资金操作指令
  const recommendations =
    verified === true
      ? ["在区块浏览器核对合约源码与当前字节码是否一致", "关注合约是否可升级（proxy）"]
      : verified === false
        ? [
            "在区块浏览器核对合约源码与当前字节码是否一致",
            "查阅该合约的验证页与项目方公布的第三方审计报告",
          ]
        : ["在区块浏览器核对合约源码与当前字节码是否一致", "查阅该合约的验证页与项目方公布的第三方审计报告"]

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

  // ⛔ `txCount === 0` **不是异常** —— 刚部署的合约、刚创建的钱包必然如此。
  // 「没有链上历史」是**覆盖盲区**，不是风险证据 → 不定级（null）。
  // ⚠️ 原实现在此定为 medium，会让「第一个查自己新钱包的用户」被告知「发现部分异常」。
  const riskLevel: RiskLevel | null = facts.txCount === 0 ? null : "low"
  const summary =
    facts.txCount === 0
      ? "该地址尚未发出过任何交易，链上历史不足，无法判定。"
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
    // ⛔ 不再恒为 "low" —— 本维度只查了价格与 TVL 两项，流动性深度/持仓集中度/
    // 解锁节奏三项**未接入**。标成「未发现异常」是**假安全感**（把「没查」
    // 说成「查了没有」）→ 改为 null（数据不足以判定）。
    null,
    "已取到 DefiLlama 的真实市场数据（价格与 TVL）。注意：代币流动性深度、持仓集中度、解锁节奏等指标需专门数据源，当前未接入，不作判断。",
    signals,
    ["结合已取到的真实价格/TVL 判断", "持仓集中度与解锁数据待接入后再评估"],
    "依据：DefiLlama coins/prices 或 protocol API（真实抓取，仅价格与 TVL 两项）",
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

  // ⛔ **零结论优先**。
  //
  // 事故背景：原实现用 reduce 的种子值 "low"，而 `d.riskLevel &&` 会跳过 null 维度
  // → 所有 live 维度都无结论时，reduce 直接返回种子 "low" → 零结论却输出
  // 「已查项未发现异常」。那比原来的「低风险」更糟：原来是模糊判断，
  // 新标签是一句**明确的事实断言**（宣称查过且没发现），实际是什么都没判定。
  //
  // 正确语义：「有结论的维度中最差的那个」；**一个结论都没有 → null**。
  const judgedDims = liveDims.filter((d) => d.riskLevel !== null)
  const overallRisk =
    judgedDims.length === 0
      ? null
      : judgedDims.reduce<RiskLevel>(
          (worst, d) =>
            d.riskLevel && RISK_ORDER[d.riskLevel] > RISK_ORDER[worst] ? d.riskLevel : worst,
          "low",
        )

  const verdict = buildVerdict(
    trimmed,
    liveDims.length,
    unavailableDims.length,
    overallRisk,
    liveDims.length - judgedDims.length,
  )

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
    disclaimer: REPORT_DISCLAIMER,
  }
}

/**
 * 构建报告结论句 —— **三态**。
 *
 * ① 完全无数据 → 不给任何结论
 * ② 取到了数据但**无一维度能定级** → 明确说「缺少可判定的结论」
 * ③ 有结论 → 给出已查项的结论
 */
function buildVerdict(
  target: string,
  liveCount: number,
  unavailableCount: number,
  overallRisk: RiskLevel | null,
  unjudgedCount: number,
): string {
  if (liveCount === 0) {
    return `本次对 ${target} 的侦察**没有取到任何真实数据**（数据源未接入或目标未被收录），因此不给出任何结论——不做无依据的推测。请检查数据源配置，或换用 DefiLlama 收录的目标。`
  }

  // ⚠️ tail 有两种「没有结论」：数据源未接入（unavailable）与取到了但无法定级
  // （live + riskLevel=null）。后者数据是取到了的，不能说成「未接入」。
  const unjudgedNote =
    unjudgedCount > 0
      ? `其中 ${unjudgedCount} 个维度的数据不足以判定，不参与定级。`
      : ""
  const tail =
    unavailableCount > 0
      ? `另有 ${unavailableCount} 个维度的数据源未接入，这些维度**不给任何数值与判断**。`
      : "所选维度均已取到真实数据。"

  // ⚠️ 零结论时**不能**输出「已查项未发现异常」—— 那是宣称「查过且没发现」。
  const riskText = overallRisk ? `，已查项的核查结论为「${RISK_LABEL[overallRisk]}」` : ""
  if (!overallRisk) {
    return `本次对 ${target} 的核查取到 ${liveCount} 个数据源的真实事实，但当前缺少可判定的结论。${unjudgedNote}${tail}报告只呈现已确认的事实，未接入的部分不做推测。`
  }
  return `本次对 ${target} 的核查取到 ${liveCount} 个数据源的真实事实${riskText}。${unjudgedNote}${tail}报告只呈现已确认的事实，未接入的部分不做推测。`
}

