import { describe, expect, it } from 'vitest'

import {
  getTokenBySymbol,
  getZeroExTokenIdentifier,
  hasVerifiedTokenAddress,
  HYPEREVM_TOKENS,
  HYPEREVM_USDC_ADDRESS,
  HYPEREVM_USDT0_ADDRESS,
  ZEROX_NATIVE_TOKEN_ADDRESS,
} from '../tokens'

describe('tokens', () => {
  it('returns only whitelist tokens in stable order', () => {
    expect(HYPEREVM_TOKENS.map((token) => token.symbol)).toEqual(['HYPE', 'USDT0', 'USDC', 'ETH', 'BTC'])
  })

  it('finds token by symbol', () => {
    expect(getTokenBySymbol('HYPE')?.symbol).toBe('HYPE')
    expect(getTokenBySymbol('DOGE')).toBeUndefined()
  })

  it('tracks whether local token addresses are verified for on-chain reads', () => {
    expect(hasVerifiedTokenAddress('HYPE')).toBe(true)
    expect(hasVerifiedTokenAddress('USDC')).toBe(true)
    expect(hasVerifiedTokenAddress('USDT0')).toBe(true)
    expect(hasVerifiedTokenAddress('ETH')).toBe(false)
  })

  it('maps symbols to 0x token identifiers', () => {
    expect(getZeroExTokenIdentifier('HYPE')).toBe(ZEROX_NATIVE_TOKEN_ADDRESS)
    expect(getZeroExTokenIdentifier('USDC')).toBe(HYPEREVM_USDC_ADDRESS)
    expect(getZeroExTokenIdentifier('USDT0')).toBe(HYPEREVM_USDT0_ADDRESS)
  })
})
