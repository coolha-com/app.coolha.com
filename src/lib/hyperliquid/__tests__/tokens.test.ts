import { describe, expect, it } from 'vitest'

import { getTokenBySymbol, HYPEREVM_TOKENS } from '../tokens'

describe('tokens', () => {
  it('returns only whitelist tokens in stable order', () => {
    expect(HYPEREVM_TOKENS.map((token) => token.symbol)).toEqual(['HYPE', 'USDT0', 'USDC', 'ETH', 'BTC'])
  })

  it('finds token by symbol', () => {
    expect(getTokenBySymbol('HYPE')?.symbol).toBe('HYPE')
    expect(getTokenBySymbol('DOGE')).toBeUndefined()
  })
})
