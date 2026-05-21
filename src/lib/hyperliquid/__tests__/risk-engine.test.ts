import { describe, expect, it } from 'vitest'

import { evaluateTradeRisk } from '../risk-engine'

describe('evaluateTradeRisk', () => {
  it('flags high price impact and low gas readiness', () => {
    const result = evaluateTradeRisk({
      hasEnoughGas: false,
      priceImpactBps: 250,
      slippageBps: 100,
    })

    expect(result.level).toBe('high')
    expect(result.flags).toContain('gas')
    expect(result.flags).toContain('price-impact')
  })
})
