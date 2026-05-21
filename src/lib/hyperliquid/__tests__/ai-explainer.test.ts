import { describe, expect, it } from 'vitest'

import { buildTradeInsight } from '../ai-explainer'

describe('buildTradeInsight', () => {
  it('returns explanation, warning, and suggestion text', () => {
    const result = buildTradeInsight({
      buySymbol: 'HYPE',
      sellSymbol: 'USDC',
      receiveAmount: '24.3',
      riskLevel: 'medium',
      riskFlags: ['slippage'],
    })

    expect(result.summary).toContain('USDC')
    expect(result.summary).toContain('HYPE')
    expect(result.suggestion).toContain('分批')
  })
})
