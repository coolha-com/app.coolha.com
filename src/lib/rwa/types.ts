export type RWALiquidityType = 'liquid' | 'locked'

export type RWAAssetType = 'bond' | 'credit' | 'real_estate'

export type RWARiskLevel = 'low' | 'medium' | 'high'

export type RWAProtocolId = 'ondo' | 'centrifuge' | 'maple'

export type RWAProtocol = {
  id: RWAProtocolId
  name: string
  website?: string
  docs?: string
}

export type RWAAsset<TMeta extends Record<string, unknown> = Record<string, unknown>> = {
  id: string
  name: string
  protocol: RWAProtocol
  assetType: RWAAssetType
  apy: number
  riskScore: number
  riskLevel: RWARiskLevel
  liquidityType: RWALiquidityType
  liquidity: 'high' | 'low'
  maturityDate?: string
  tvl: number
  chainId?: number
  tags?: string[]
  metadata?: TMeta
  description?: string
}

export type RWAFlowPoint = {
  label: string
  inflow: number
  outflow: number
}

export type RWAFlowSeries = {
  assetId: string
  unit: 'USDC'
  points: RWAFlowPoint[]
}

export type RwaaApyPoint = {
  date: string
  apy: number
}

export type RWAAssetDetail = {
  asset: RWAAsset
  apyHistory: RwaaApyPoint[]
  fundFlow: RWAFlowSeries
}

export type RWAFilter = {
  apyMin?: number
  apyMax?: number
  riskLevels: RWARiskLevel[]
  assetTypes: RWAAssetType[]
  liquidityTypes: RWALiquidityType[]
  liquidity: Array<'high' | 'low'>
  protocols: RWAProtocolId[]
}

export type RouterTxRequest = {
  chainId: number
  to: `0x${string}`
  data: `0x${string}`
  value?: bigint
}

export type RouterSimulation = {
  tx: RouterTxRequest
  estimatedGas: bigint
  routeLabel: string
  txHashPreview: `0x${string}`
}

export type RouterTradeParams = {
  assetId: string
  amountIn: number
  tokenIn: 'USDC'
  chainId: number
  user?: `0x${string}`
}

export type RouterAdapter = {
  id: string
  label: string
  simulate: (params: RouterTradeParams) => Promise<RouterSimulation>
}
