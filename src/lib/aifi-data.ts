export type AiAsset = {
  name: string
  symbol: string
  provider: string
  category: string
  version: string
  context: string
  capability: string
  apiPrice: string
  availability: string
  latency: string
  throughput: string
  billing: string
  access: string
}

export type AgentService = {
  name: string
  category: string
  provider: string
  service: string
  settlement: string
  identity: string
  trust: string
}

export type RwaAsset = {
  name: string
  symbol: string
  type: string
  issuer: string
  jurisdiction: string
  underlying: string
  nav: string
  distribution: string
  maturity: string
  totalValue: string
  availableSupply: string
  blockchain: string
  eligibility: string
  risk: string
}

export type PortfolioPosition = {
  asset: string
  type: string
  balance: string
  price: string
  value: string
}

export type SubscriptionProduct = {
  name: string
  type: string
  price: string
  cadence: string
  chain: string
  includes: string
}

export const aiAssets: AiAsset[] = []
export const agentServices: AgentService[] = []
export const rwaAssets: RwaAsset[] = []
export const portfolioPositions: PortfolioPosition[] = []
export const subscriptionProducts: SubscriptionProduct[] = []

export const supportedChains = ["Ethereum", "Base", "Polygon", "Arbitrum"]

export const settlementSteps = [
  "连接 EVM 钱包",
  "选择 AI 订阅或 X 会员",
  "使用 USDC / USDT 支付账单",
  "确认后发放钱包权益",
  "按真实用量计费或跟踪履约",
]
