export type RiskLevel = "Low" | "Medium" | "High"

export type AssetStructure = "SPV" | "债权" | "混合结构"

export type AssetProfile = {
  id: string
  name: string
  category: string
  baseYield: number
  volatility: number
  collateralization: number
  liquidityScore: number
  durationDays: number
  onchainMomentum: number
  structure: AssetStructure
  underlying: string
  incomeSources: string[]
}

export type RiskScoreResult = {
  score: number
  level: RiskLevel
  summary: string
  drivers: string[]
}

export type AssetAnalysis = {
  asset: AssetProfile
  incomeBreakdown: string[]
  structureNotes: string[]
  risk: RiskScoreResult
  aiSummary: string
}

export type PortfolioUserProfile = {
  userId: string
  riskTolerance: "conservative" | "balanced" | "growth"
  focus?: "income" | "liquidity" | "diversification"
}

export type PortfolioSuggestionItem = {
  assetId: string
  assetName: string
  weight: number
  expectedYield: number
  thesis: string
}

export type PortfolioSuggestion = {
  strategy: string
  expectedYield: number
  items: PortfolioSuggestionItem[]
}

const MOCK_ASSETS: AssetProfile[] = [
  {
    id: "us-credit-note",
    name: "US Credit Note",
    category: "Private Credit",
    baseYield: 8.6,
    volatility: 24,
    collateralization: 72,
    liquidityScore: 58,
    durationDays: 180,
    onchainMomentum: 61,
    structure: "SPV",
    underlying: "美国中短久期企业应收账款",
    incomeSources: ["基础票息", "服务费回收", "提前还款补偿"],
  },
  {
    id: "treasury-vault",
    name: "Treasury Vault",
    category: "US Treasury",
    baseYield: 5.1,
    volatility: 8,
    collateralization: 96,
    liquidityScore: 91,
    durationDays: 30,
    onchainMomentum: 44,
    structure: "债权",
    underlying: "美国短债与回购组合",
    incomeSources: ["国债票息", "回购利差", "管理费返还"],
  },
  {
    id: "invoice-pool-alpha",
    name: "Invoice Pool Alpha",
    category: "Trade Finance",
    baseYield: 11.2,
    volatility: 35,
    collateralization: 66,
    liquidityScore: 46,
    durationDays: 120,
    onchainMomentum: 79,
    structure: "混合结构",
    underlying: "跨境贸易发票池",
    incomeSources: ["保理收益", "逾期罚息", "流动性激励"],
  },
  {
    id: "real-estate-income",
    name: "Real Estate Income",
    category: "Real Estate",
    baseYield: 9.4,
    volatility: 28,
    collateralization: 75,
    liquidityScore: 52,
    durationDays: 365,
    onchainMomentum: 57,
    structure: "SPV",
    underlying: "核心区稳定租金物业",
    incomeSources: ["租金现金流", "运营净收入", "资产处置分成"],
  },
]

export function listMockAssets(): AssetProfile[] {
  return MOCK_ASSETS
}

export function getAssetProfile(asset: string | AssetProfile): AssetProfile {
  if (typeof asset !== "string") return asset

  const matched = MOCK_ASSETS.find((item) => item.id === asset || item.name === asset)
  return matched ?? MOCK_ASSETS[0]
}

function toRiskLevel(score: number): RiskLevel {
  if (score >= 70) return "High"
  if (score >= 40) return "Medium"
  return "Low"
}

export function generateRiskScore(asset: string | AssetProfile): RiskScoreResult {
  const profile = getAssetProfile(asset)

  const rawScore =
    profile.volatility * 0.55 +
    (100 - profile.collateralization) * 0.75 +
    (100 - profile.liquidityScore) * 0.35 +
    Math.min(profile.durationDays / 8, 18) +
    (profile.onchainMomentum > 72 ? 8 : 0)

  const score = Math.max(16, Math.min(92, Math.round(rawScore)))
  const level = toRiskLevel(score)

  const drivers = [
    `抵押覆盖率 ${profile.collateralization}%`,
    `流动性评分 ${profile.liquidityScore}/100`,
    `期限 ${profile.durationDays} 天`,
  ]

  if (profile.volatility >= 30) drivers.push("收益波动偏高，适合更高风险预算")
  if (profile.onchainMomentum >= 70) drivers.push("链上活跃度抬升，短期关注大额资金进出")
  if (profile.structure === "SPV") drivers.push("SPV 隔离底层资产与协议风险")

  const summary =
    level === "Low"
      ? "适合以稳健收益和高流动性为优先的配置。"
      : level === "Medium"
        ? "收益与结构复杂度平衡，适合中性风险偏好。"
        : "高收益依赖更强的结构管理与持续监控。"

  return { score, level, summary, drivers }
}

export function generateAnalysis(asset: string | AssetProfile): AssetAnalysis {
  const profile = getAssetProfile(asset)
  const risk = generateRiskScore(profile)

  const structureNotes =
    profile.structure === "SPV"
      ? [
          "通过 SPV 持有底层资产，隔离协议主体与资产权属。",
          "现金流优先回补准备金，再按份额分配给持有人。",
          "适合接入审计、托管与链上证明模块。",
        ]
      : profile.structure === "债权"
        ? [
            "收益由债权票息与回购利差构成，结构透明。",
            "期限较短，便于滚动再平衡。",
            "主要关注利率波动与赎回排队压力。",
          ]
        : [
            "混合结构同时包含保理债权与激励补贴。",
            "收益更高，但底层应收账款质量更关键。",
            "需要持续观察逾期率与集中度上升。",
          ]

  const aiSummary = `AI 认为 ${profile.name} 的核心价值在于 ${profile.underlying} 带来的可预测现金流，当前风险级别为 ${risk.level}，更适合把它放在以收益增强为目标的 RWA 篮子中。`

  return {
    asset: profile,
    incomeBreakdown: profile.incomeSources,
    structureNotes,
    risk,
    aiSummary,
  }
}

export function generatePortfolio(user: PortfolioUserProfile): PortfolioSuggestion {
  const assets = [...MOCK_ASSETS]

  const sorted =
    user.riskTolerance === "conservative"
      ? assets.sort((a, b) => generateRiskScore(a).score - generateRiskScore(b).score)
      : user.riskTolerance === "growth"
        ? assets.sort((a, b) => b.baseYield - a.baseYield)
        : assets.sort((a, b) => b.onchainMomentum + b.baseYield - (a.onchainMomentum + a.baseYield))

  const picks = sorted.slice(0, 3)
  const weights =
    user.riskTolerance === "conservative"
      ? [45, 35, 20]
      : user.riskTolerance === "growth"
        ? [40, 35, 25]
        : [40, 30, 30]

  const items = picks.map((asset, index) => ({
    assetId: asset.id,
    assetName: asset.name,
    weight: weights[index],
    expectedYield: Number((asset.baseYield + asset.onchainMomentum * 0.01).toFixed(2)),
    thesis:
      index === 0
        ? "作为核心仓位，兼顾收益与可解释性。"
        : index === 1
          ? "补充不同底层现金流来源，降低相关性。"
          : "提供额外 alpha，适合小比例增强收益。",
  }))

  const expectedYield = Number(
    (
      items.reduce((sum, item) => {
        return sum + item.weight * item.expectedYield
      }, 0) / 100
    ).toFixed(2)
  )

  const strategy =
    user.riskTolerance === "conservative"
      ? "稳健收益组合"
      : user.riskTolerance === "growth"
        ? "进取增强组合"
        : "平衡型 RWA 组合"

  return {
    strategy,
    expectedYield,
    items,
  }
}
