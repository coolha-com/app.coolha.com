export type TokenSymbol = 'HYPE' | 'USDT0' | 'USDC' | 'ETH' | 'BTC'

export type TokenAddress = `0x${string}` | 'native'

export type RiskLevel = 'low' | 'medium' | 'high'

export type RiskFlag = 'gas' | 'price-impact' | 'slippage'

export type TokenDefinition = {
  symbol: TokenSymbol
  name: string
  address: TokenAddress
  decimals: number
  icon: string
}

export type QuoteRouteFill = {
  fromSymbol: string
  toSymbol: string
  source: string
}

export type QuoteSummary = {
  allowanceTarget?: `0x${string}`
  buyAmount: string
  minBuyAmount: string
  sellAmount: string
  integratorFeeAmount: string
  routeSummary: string
  routeFills?: QuoteRouteFill[]
}

export type SwapTransactionRequest = {
  to: `0x${string}`
  data: `0x${string}`
  value: bigint
}

export type RiskEvaluation = {
  level: RiskLevel
  flags: RiskFlag[]
}

export type RiskEvaluationInput = {
  hasEnoughGas: boolean
  priceImpactBps: number
  slippageBps: number
}

export type TradeInsight = {
  summary: string
  warning: string
  suggestion: string
}

export type TradeInsightInput = {
  sellSymbol: string
  buySymbol: string
  receiveAmount: string
  riskLevel: RiskLevel
  riskFlags: RiskFlag[]
}
