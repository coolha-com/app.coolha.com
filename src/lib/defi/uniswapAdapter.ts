import type { BuyRWAParams, DefiRouteSimulation, DefiRouterAdapter, SwapParams } from './router'
import { hexPreview } from './router'

const UNISWAP_SWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564'

function buildSimulation(action: 'swap' | 'buyRWA', routeLabel: string, seed: string, chainId: number): DefiRouteSimulation {
  return {
    adapterId: 'uniswap-v3',
    adapterLabel: 'Uniswap Router（模拟）',
    action,
    routeLabel,
    tx: {
      chainId,
      to: UNISWAP_SWAP_ROUTER,
      data: '0x' as `0x${string}`,
      value: 0n,
    },
    estimatedGas: action === 'buyRWA' ? 238_000n : 185_000n,
    txHashPreview: hexPreview(seed),
    warnings: ['Mock simulation only. No transaction is signed or submitted.'],
  }
}

async function swap(params: SwapParams): Promise<DefiRouteSimulation> {
  return buildSimulation(
    'swap',
    `${params.tokenIn} -> ${params.tokenOut} via Uniswap V3 mock route`,
    `swap:${params.tokenIn}:${params.tokenOut}:${params.amountIn}:${params.chainId}:${params.user ?? 'guest'}`,
    params.chainId,
  )
}

async function buyRWA(params: BuyRWAParams): Promise<DefiRouteSimulation> {
  return buildSimulation(
    'buyRWA',
    `${params.tokenIn} -> ${params.assetId} via Uniswap Router mock route`,
    `buyRWA:${params.assetId}:${params.tokenIn}:${params.amountIn}:${params.chainId}:${params.user ?? 'guest'}`,
    params.chainId,
  )
}

export const uniswapAdapter: DefiRouterAdapter = {
  id: 'uniswap-v3',
  label: 'Uniswap V3 Adapter',
  protocols: ['uniswap'],
  swap,
  buyRWA,
}
