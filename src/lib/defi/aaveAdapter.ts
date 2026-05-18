import type { DefiRouteSimulation, DefiRouterAdapter, LendParams } from './router'
import { hexPreview } from './router'

const AAVE_POOL_PROXY = '0x0000000000000000000000000000000000000000'

async function lend(params: LendParams): Promise<DefiRouteSimulation> {
  return {
    adapterId: 'aave-v3',
    adapterLabel: 'Aave V3 Adapter（模拟）',
    action: 'lend',
    routeLabel: `${params.token} supply -> ${params.marketId ?? 'Aave market'} mock route`,
    tx: {
      chainId: params.chainId,
      to: AAVE_POOL_PROXY,
      data: '0x' as `0x${string}`,
      value: 0n,
    },
    estimatedGas: 172_000n,
    txHashPreview: hexPreview(`lend:${params.token}:${params.amount}:${params.chainId}:${params.user ?? 'guest'}`),
    warnings: ['Aave adapter is scaffolded for future lending routes.'],
  }
}

export const aaveAdapter: DefiRouterAdapter = {
  id: 'aave-v3',
  label: 'Aave V3 Adapter',
  protocols: ['aave'],
  lend,
}
