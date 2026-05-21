import { describe, expect, it } from 'vitest'

import { getTokenBySymbol, hasVerifiedTokenAddress, HYPEREVM_TOKENS } from '../tokens'

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
    expect(hasVerifiedTokenAddress('USDC')).toBe(false)
  })
})
