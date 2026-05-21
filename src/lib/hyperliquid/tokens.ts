import type { TokenDefinition, TokenSymbol } from './types'

export const ZEROX_NATIVE_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as const
export const WHYPE_ADDRESS = '0x5555555555555555555555555555555555555555' as const
export const HYPEREVM_USDT0_ADDRESS = '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb' as const
export const HYPEREVM_USDC_ADDRESS = '0xb88339CB7199b77E23DB6E890353E22632Ba630f' as const

export const HYPEREVM_TOKENS: TokenDefinition[] = [
  {
    symbol: 'HYPE',
    name: 'Hyperliquid',
    address: 'native',
    decimals: 18,
    icon: '/tokens/hype.png',
    isAddressVerified: true,
  },
  {
    symbol: 'USDT0',
    name: 'USDT0',
    address: HYPEREVM_USDT0_ADDRESS,
    decimals: 6,
    icon: '/tokens/usdt0.png',
    isAddressVerified: true,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: HYPEREVM_USDC_ADDRESS,
    decimals: 6,
    icon: '/tokens/usdc.png',
    isAddressVerified: true,
  },
  {
    symbol: 'ETH',
    name: 'Ether',
    address: '0x3333333333333333333333333333333333333333',
    decimals: 18,
    icon: '/tokens/eth.png',
    isAddressVerified: false,
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    address: '0x4444444444444444444444444444444444444444',
    decimals: 8,
    icon: '/tokens/btc.png',
    isAddressVerified: false,
  },
]

export function getTokenBySymbol(symbol: string): TokenDefinition | undefined {
  const normalizedSymbol = symbol.toUpperCase() as TokenSymbol

  return HYPEREVM_TOKENS.find((token) => token.symbol === normalizedSymbol)
}

export function hasVerifiedTokenAddress(symbol: string): boolean {
  const token = getTokenBySymbol(symbol)

  return token?.isAddressVerified ?? false
}

export function getZeroExTokenIdentifier(symbol: string): string | undefined {
  const token = getTokenBySymbol(symbol)

  if (!token) {
    return undefined
  }

  return token.address === 'native' ? ZEROX_NATIVE_TOKEN_ADDRESS : token.address
}
