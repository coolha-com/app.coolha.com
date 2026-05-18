import { aaveAdapter } from './aaveAdapter'
import { uniswapAdapter } from './uniswapAdapter'

export type DefiProtocol = 'uniswap' | 'aave' | 'ondo' | (string & {})

export type TokenSymbol = 'USDC' | 'USDT' | 'WETH' | (string & {})

export type DefiTransactionRequest = {
  chainId: number
  to: `0x${string}`
  data: `0x${string}`
  value?: bigint
}

export type DefiRouteSimulation = {
  adapterId: string
  adapterLabel: string
  action: 'swap' | 'lend' | 'buyRWA'
  routeLabel: string
  tx: DefiTransactionRequest
  estimatedGas: bigint
  txHashPreview: `0x${string}`
  warnings: string[]
}

export type SwapParams = {
  tokenIn: TokenSymbol
  tokenOut: TokenSymbol
  amountIn: number
  chainId: number
  user?: `0x${string}`
  slippageBps?: number
}

export type LendParams = {
  token: TokenSymbol
  amount: number
  chainId: number
  user?: `0x${string}`
  marketId?: string
}

export type BuyRWAParams = {
  assetId: string
  tokenIn: TokenSymbol
  amountIn: number
  chainId: number
  user?: `0x${string}`
  protocol?: DefiProtocol
}

export type DefiRouterAdapter = {
  id: string
  label: string
  protocols: DefiProtocol[]
  swap?: (params: SwapParams) => Promise<DefiRouteSimulation>
  lend?: (params: LendParams) => Promise<DefiRouteSimulation>
  buyRWA?: (params: BuyRWAParams) => Promise<DefiRouteSimulation>
}

export class DefiRouter {
  constructor(private readonly adapters: DefiRouterAdapter[]) {}

  async swap(params: SwapParams): Promise<DefiRouteSimulation> {
    return this.requireAdapter('swap', params.tokenOut).swap!(params)
  }

  async lend(params: LendParams): Promise<DefiRouteSimulation> {
    return this.requireAdapter('lend', 'aave').lend!(params)
  }

  async buyRWA(params: BuyRWAParams): Promise<DefiRouteSimulation> {
    return this.requireAdapter('buyRWA', params.protocol ?? 'uniswap').buyRWA!(params)
  }

  listAdapters(): DefiRouterAdapter[] {
    return [...this.adapters]
  }

  private requireAdapter(
    action: keyof Pick<DefiRouterAdapter, 'swap' | 'lend' | 'buyRWA'>,
    protocolHint: string,
  ): Required<Pick<DefiRouterAdapter, typeof action>> & DefiRouterAdapter {
    const adapter = this.adapters.find((item) => {
      return Boolean(item[action]) && (item.protocols.includes(protocolHint) || item.id.includes(protocolHint))
    })

    if (!adapter) {
      const fallback = this.adapters.find((item) => Boolean(item[action]))
      if (fallback) return fallback as Required<Pick<DefiRouterAdapter, typeof action>> & DefiRouterAdapter
      throw new Error(`No DeFi router adapter can handle ${action}.`)
    }

    return adapter as Required<Pick<DefiRouterAdapter, typeof action>> & DefiRouterAdapter
  }
}

export function hexPreview(input: string): `0x${string}` {
  const bytes = new TextEncoder().encode(input)
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return `0x${out.slice(0, 64).padEnd(64, '0')}` as `0x${string}`
}

export function createDefaultDefiRouter(): DefiRouter {
  return new DefiRouter([uniswapAdapter, aaveAdapter])
}

export async function simulateTransaction(params: BuyRWAParams): Promise<DefiRouteSimulation> {
  return createDefaultDefiRouter().buyRWA(params)
}
