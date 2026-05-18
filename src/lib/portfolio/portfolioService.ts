import { RWA_ASSETS } from '@/lib/rwa/mockData'
import type { RWAAssetType, RWARiskLevel } from '@/lib/rwa/types'

export type PortfolioHolding = {
  id: string
  assetId: string
  assetName: string
  protocol: string
  assetType: RWAAssetType
  amount: number
  valueUsd: number
  apy: number
  maturityDate?: string
  riskLevel: RWARiskLevel
  riskScore: number
}

export type PortfolioDistributionItem = {
  label: string
  valueUsd: number
  percentage: number
}

export type PortfolioTrendPoint = {
  date: string
  valueUsd: number
  dailyYieldUsd: number
}

export type PortfolioRiskExposure = {
  highRiskRatio: number
  mediumRiskRatio: number
  lowRiskRatio: number
  aiHint: string
}

export type PortfolioSnapshot = {
  walletAddress?: `0x${string}`
  totalBalanceUsd: number
  todayYieldUsd: number
  holdings: PortfolioHolding[]
  distributionByAssetType: PortfolioDistributionItem[]
  distributionByProtocol: PortfolioDistributionItem[]
  yieldTrend: PortfolioTrendPoint[]
  riskExposure: PortfolioRiskExposure
  dataSources: string[]
}

const MOCK_HOLDING_WEIGHTS: Array<{ assetId: string; valueUsd: number; amount: number }> = [
  { assetId: 'ondo-usdy', valueUsd: 38_400, amount: 38_120.44 },
  { assetId: 'centrifuge-tbill', valueUsd: 24_800, amount: 247.6 },
  { assetId: 'maple-credit', valueUsd: 16_500, amount: 152.24 },
  { assetId: 'ondo-ousg', valueUsd: 12_300, amount: 108.1 },
  { assetId: 'centrifuge-re', valueUsd: 8_000, amount: 72.9 },
]

function compactPercent(value: number, total: number): number {
  if (total <= 0) return 0
  return Number(((value / total) * 100).toFixed(1))
}

function toDistribution<T extends string>(
  holdings: PortfolioHolding[],
  getKey: (holding: PortfolioHolding) => T,
): PortfolioDistributionItem[] {
  const total = holdings.reduce((sum, item) => sum + item.valueUsd, 0)
  const buckets = holdings.reduce<Record<string, number>>((acc, holding) => {
    const key = getKey(holding)
    acc[key] = (acc[key] ?? 0) + holding.valueUsd
    return acc
  }, {})

  return Object.entries(buckets)
    .map(([label, valueUsd]) => ({
      label,
      valueUsd,
      percentage: compactPercent(valueUsd, total),
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd)
}

function buildYieldTrend(totalBalanceUsd: number): PortfolioTrendPoint[] {
  return Array.from({ length: 10 }).map((_, index) => {
    const drift = (index - 4) * 92
    const wave = index % 3 === 0 ? 180 : -70
    const valueUsd = Number((totalBalanceUsd - 850 + drift + wave).toFixed(2))
    return {
      date: `2026-05-${String(index + 9).padStart(2, '0')}`,
      valueUsd,
      dailyYieldUsd: Number((valueUsd * 0.00042 + index * 2.4).toFixed(2)),
    }
  })
}

function buildRiskExposure(holdings: PortfolioHolding[], totalBalanceUsd: number): PortfolioRiskExposure {
  const riskValue = (level: RWARiskLevel) =>
    holdings.filter((item) => item.riskLevel === level).reduce((sum, item) => sum + item.valueUsd, 0)

  const highRiskRatio = compactPercent(riskValue('high'), totalBalanceUsd)
  const mediumRiskRatio = compactPercent(riskValue('medium'), totalBalanceUsd)
  const lowRiskRatio = compactPercent(riskValue('low'), totalBalanceUsd)

  const aiHint =
    highRiskRatio >= 25
      ? '高风险 RWA 仓位偏高，建议把新增资金优先分配到短久期国债或高流动性资产。'
      : mediumRiskRatio >= 45
        ? '组合风险处于中性区间，适合继续观察锁仓资产赎回窗口。'
        : '组合偏稳健，可在不提高高风险占比的前提下增加收益增强仓位。'

  return {
    highRiskRatio,
    mediumRiskRatio,
    lowRiskRatio,
    aiHint,
  }
}

export function aggregateMockPortfolio(walletAddress?: `0x${string}`): PortfolioSnapshot {
  const holdings = MOCK_HOLDING_WEIGHTS.map((mock) => {
    const asset = RWA_ASSETS.find((item) => item.id === mock.assetId) ?? RWA_ASSETS[0]
    return {
      id: `holding-${asset.id}`,
      assetId: asset.id,
      assetName: asset.name,
      protocol: asset.protocol.name,
      assetType: asset.assetType,
      amount: mock.amount,
      valueUsd: mock.valueUsd,
      apy: asset.apy,
      maturityDate: asset.maturityDate,
      riskLevel: asset.riskLevel,
      riskScore: asset.riskScore,
    } satisfies PortfolioHolding
  })

  const totalBalanceUsd = holdings.reduce((sum, item) => sum + item.valueUsd, 0)
  const todayYieldUsd = Number((holdings.reduce((sum, item) => sum + item.valueUsd * (item.apy / 100 / 365), 0)).toFixed(2))

  return {
    walletAddress,
    totalBalanceUsd,
    todayYieldUsd,
    holdings,
    distributionByAssetType: toDistribution(holdings, (holding) => holding.assetType),
    distributionByProtocol: toDistribution(holdings, (holding) => holding.protocol),
    yieldTrend: buildYieldTrend(totalBalanceUsd),
    riskExposure: buildRiskExposure(holdings, totalBalanceUsd),
    dataSources: ['Ondo mock adapter', 'Centrifuge mock adapter', 'Maple mock adapter'],
  }
}
