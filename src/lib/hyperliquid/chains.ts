import { defineChain } from 'viem'

export const HYPEREVM_CHAIN_ID = 999

export const HYPEREVM_MAINNET = defineChain({
  id: HYPEREVM_CHAIN_ID,
  name: 'HyperEVM',
  nativeCurrency: {
    decimals: 18,
    name: 'HYPE',
    symbol: 'HYPE',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.hyperliquid.xyz/evm'],
    },
  },
  blockExplorers: {
    default: {
      name: 'HyperEVM Scan',
      url: 'https://hyperevmscan.io',
    },
  },
})
