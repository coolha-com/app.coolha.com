import { describe, expect, it } from 'vitest'

import {
  applyZeroExMonetizationParams,
  normalizePriceResponse,
  resolveZeroExMonetizationConfig,
} from '../quotes'

describe('normalizePriceResponse', () => {
  it('maps 0x response into UI quote model', () => {
    const quote = normalizePriceResponse({
      allowanceTarget: '0xabc',
      buyAmount: '1200000',
      minBuyAmount: '1180000',
      sellAmount: '1000000',
      fees: {
        integratorFee: {
          amount: '1000',
          token: '0x9999999999999999999999999999999999999999',
        },
      },
      route: {
        fills: [{ source: 'UniswapV3' }, { source: '0x_RFQ' }],
      },
    })

    expect(quote.routeSummary).toBe('UniswapV3 > 0x_RFQ')
    expect(quote.integratorFeeAmount).toBe('1000')
    expect(quote.integratorFeeToken).toBe('0x9999999999999999999999999999999999999999')
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

  it('uses swap fee params for monetization and keeps affiliate attribution separate', () => {
    const config = resolveZeroExMonetizationConfig({
      affiliateAddress: '0x1111111111111111111111111111111111111111',
      swapFeeRecipient: '0x2222222222222222222222222222222222222222',
      swapFeeBps: '35',
    })
    const params = applyZeroExMonetizationParams(new URLSearchParams(), config)

    expect(config.feeEnabled).toBe(true)
    expect(params.get('affiliateAddress')).toBe('0x1111111111111111111111111111111111111111')
    expect(params.get('swapFeeRecipient')).toBe('0x2222222222222222222222222222222222222222')
    expect(params.get('swapFeeBps')).toBe('35')
  })

  it('disables builder fee when the config is incomplete', () => {
    const config = resolveZeroExMonetizationConfig({
      swapFeeRecipient: '0x2222222222222222222222222222222222222222',
      swapFeeBps: 'oops',
    })
    const params = applyZeroExMonetizationParams(new URLSearchParams(), config)

    expect(config.feeEnabled).toBe(false)
    expect(params.get('swapFeeRecipient')).toBeNull()
    expect(params.get('swapFeeBps')).toBeNull()
  })
})
