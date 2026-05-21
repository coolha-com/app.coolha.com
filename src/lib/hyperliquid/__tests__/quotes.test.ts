import { describe, expect, it } from 'vitest'

import { normalizePriceResponse } from '../quotes'

describe('normalizePriceResponse', () => {
  it('maps 0x response into UI quote model', () => {
    const quote = normalizePriceResponse({
      allowanceTarget: '0xabc',
      buyAmount: '1200000',
      minBuyAmount: '1180000',
      sellAmount: '1000000',
      fees: {
        integratorFee: { amount: '1000' },
      },
      route: {
        fills: [{ source: 'UniswapV3' }, { source: '0x_RFQ' }],
      },
    })

    expect(quote.routeSummary).toBe('UniswapV3 > 0x_RFQ')
    expect(quote.integratorFeeAmount).toBe('1000')
    expect(quote.minBuyAmount).toBe('1180000')
  })

  it('falls back to defaults when optional fields are missing', () => {
    const quote = normalizePriceResponse({
      buyAmount: '250',
      sellAmount: '100',
    })

    expect(quote.minBuyAmount).toBe('250')
    expect(quote.integratorFeeAmount).toBe('0')
    expect(quote.routeSummary).toBe('Direct')
    expect(quote.routeFills).toBeUndefined()
  })
})
