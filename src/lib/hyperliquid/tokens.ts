import type { TokenDefinition, TokenSymbol } from './types'

export const HYPEREVM_TOKENS: TokenDefinition[] = [
  {
    symbol: 'HYPE',
    name: 'Hyperliquid',
    address: 'native',
    decimals: 18,
    icon: '/tokens/hype.png',
  },
  {
    symbol: 'USDT0',
    name: 'USDT0',
    address: '0x1111111111111111111111111111111111111111',
    decimals: 6,
    icon: '/tokens/usdt0.png',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x2222222222222222222222222222222222222222',
    decimals: 6,
    icon: '/tokens/usdc.png',
  },
  {
    symbol: 'ETH',
    name: 'Ether',
    address: '0x3333333333333333333333333333333333333333',
    decimals: 18,
    icon: '/tokens/eth.png',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    address: '0x4444444444444444444444444444444444444444',
    decimals: 8,
    icon: '/tokens/btc.png',
  },
]

export function getTokenBySymbol(symbol: string): TokenDefinition | undefined {
  const normalizedSymbol = symbol.toUpperCase() as TokenSymbol

  return HYPEREVM_TOKENS.find((token) => token.symbol === normalizedSymbol)
}
