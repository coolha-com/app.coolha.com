import type { RWAAsset, RWAAssetDetail, RWAProtocol } from './types'

export const RWA_PROTOCOLS: Record<string, RWAProtocol> = {
  ondo: { id: 'ondo', name: 'Ondo', website: 'https://ondo.finance' },
  centrifuge: { id: 'centrifuge', name: 'Centrifuge', website: 'https://centrifuge.io' },
  maple: { id: 'maple', name: 'Maple', website: 'https://maple.finance' },
}

export const RWA_ASSETS: RWAAsset[] = [
  {
    id: 'ondo-usdy',
    name: 'USDY (Tokenized Yield)',
    protocol: RWA_PROTOCOLS.ondo,
    assetType: 'bond',
    apy: 5.1,
    riskScore: 18,
    riskLevel: 'low',
    liquidityType: 'liquid',
    liquidity: 'high',
    tvl: 420_000_000,
    chainId: 1,
    tags: ['Treasury', 'Stable Yield'],
    maturityDate: undefined,
    description: '以短久期国债/现金等价物为底层的收益型代币化资产。',
    metadata: { collateral: 'US Treasuries', region: 'US' },
  },
  {
    id: 'centrifuge-tbill',
    name: 'T-Bill Pool Note',
    protocol: RWA_PROTOCOLS.centrifuge,
    assetType: 'bond',
    apy: 4.6,
    riskScore: 22,
    riskLevel: 'low',
    liquidityType: 'locked',
    liquidity: 'low',
    maturityDate: '2027-06-30',
    tvl: 165_000_000,
    chainId: 1,
    tags: ['SPV', 'Note'],
    description: '链上结构化票据，挂钩国债收益，赎回周期较长。',
    metadata: { tranche: 'Senior', currency: 'USD' },
  },
  {
    id: 'maple-credit',
    name: 'Maple Institutional Credit',
    protocol: RWA_PROTOCOLS.maple,
    assetType: 'credit',
    apy: 7.4,
    riskScore: 46,
    riskLevel: 'medium',
    liquidityType: 'locked',
    liquidity: 'low',
    maturityDate: '2026-12-15',
    tvl: 92_000_000,
    chainId: 1,
    tags: ['Credit', 'Institutional'],
    description: '机构级信贷池，风险更高但收益更突出。',
    metadata: { borrowerType: 'Institutional', overcollateralized: false },
  },
  {
    id: 'ondo-ousg',
    name: 'OUSG (Tokenized Treasuries)',
    protocol: RWA_PROTOCOLS.ondo,
    assetType: 'bond',
    apy: 4.2,
    riskScore: 20,
    riskLevel: 'low',
    liquidityType: 'liquid',
    liquidity: 'high',
    tvl: 310_000_000,
    chainId: 1,
    tags: ['Treasury', 'ETF Wrapper'],
    description: '代币化国债敞口，面向链上稳定收益配置。',
    metadata: { wrapper: 'Fund', region: 'US' },
  },
  {
    id: 'centrifuge-re',
    name: 'Real Estate Income Pool',
    protocol: RWA_PROTOCOLS.centrifuge,
    assetType: 'real_estate',
    apy: 8.9,
    riskScore: 61,
    riskLevel: 'high',
    liquidityType: 'locked',
    liquidity: 'low',
    maturityDate: '2029-03-01',
    tvl: 38_500_000,
    chainId: 1,
    tags: ['Real Estate', 'Income'],
    description: '地产现金流资产池，收益更高但锁仓与波动风险更大。',
    metadata: { region: 'EU', propertyType: 'Commercial' },
  },
  {
    id: 'maple-treasury',
    name: 'Maple Short Duration',
    protocol: RWA_PROTOCOLS.maple,
    assetType: 'bond',
    apy: 5.8,
    riskScore: 33,
    riskLevel: 'medium',
    liquidityType: 'liquid',
    liquidity: 'high',
    maturityDate: '2026-09-30',
    tvl: 56_200_000,
    chainId: 1,
    tags: ['Short Duration'],
    description: '短久期收益策略，兼顾收益与流动性。',
    metadata: { durationDays: 90 },
  },
]

export const RWA_DETAILS: Record<string, RWAAssetDetail> = Object.fromEntries(
  RWA_ASSETS.map((asset) => {
    const baseApy = asset.apy
    const apyHistory = Array.from({ length: 12 }).map((_, index) => {
      const delta = (index % 3 === 0 ? 0.15 : -0.08) * (asset.riskLevel === 'high' ? 1.6 : asset.riskLevel === 'medium' ? 1.1 : 0.8)
      return {
        date: `2026-${String(index + 1).padStart(2, '0')}-01`,
        apy: Math.max(0, Number((baseApy + delta + (index - 5) * 0.03).toFixed(2))),
      }
    })

    const points = Array.from({ length: 8 }).map((_, index) => {
      const inflow = Math.max(0, Math.round(asset.tvl / 100_000_000) * 12 + index * 7 + (asset.liquidityType === 'liquid' ? 18 : 6))
      const outflow = Math.max(0, inflow - (asset.riskLevel === 'high' ? 10 : asset.riskLevel === 'medium' ? 5 : 2))
      return {
        label: `W${index + 1}`,
        inflow,
        outflow,
      }
    })

    return [
      asset.id,
      {
        asset,
        apyHistory,
        fundFlow: {
          assetId: asset.id,
          unit: 'USDC',
          points,
        },
      } satisfies RWAAssetDetail,
    ]
  }),
)

export function getRwaAssetById(id: string): RWAAsset | undefined {
  return RWA_ASSETS.find((item) => item.id === id)
}

export function getRwaDetailById(id: string): RWAAssetDetail | undefined {
  return RWA_DETAILS[id]
}
