import type { RouterAdapter, RouterSimulation, RouterTradeParams } from './types'

function hexify(input: string): `0x${string}` {
  const bytes = new TextEncoder().encode(input)
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return `0x${out.slice(0, 64).padEnd(64, '0')}` as `0x${string}`
}

function fakeTxHash(params: RouterTradeParams, label: string): `0x${string}` {
  return hexify(`${label}:${params.assetId}:${params.amountIn}:${params.chainId}:${params.tokenIn}`)
}

export const uniswapV3Adapter: RouterAdapter = {
  id: 'uniswap-v3',
  label: 'Uniswap Router（模拟）',
  async simulate(params: RouterTradeParams): Promise<RouterSimulation> {
    return {
      tx: {
        chainId: params.chainId,
        to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        data: '0x' as `0x${string}`,
        value: 0n,
      },
      estimatedGas: 210_000n,
      routeLabel: 'USDC → RWA（mock route）',
      txHashPreview: fakeTxHash(params, 'uniswap-v3'),
    }
  },
}

export const DEFAULT_ROUTER_ADAPTERS: RouterAdapter[] = [uniswapV3Adapter]

export function pickRouterAdapter(): RouterAdapter {
  return DEFAULT_ROUTER_ADAPTERS[0]
}

