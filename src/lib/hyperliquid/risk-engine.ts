import type { RiskEvaluation, RiskEvaluationInput } from './types'

const HIGH_PRICE_IMPACT_BPS = 200
const ELEVATED_SLIPPAGE_BPS = 100

export function evaluateTradeRisk(input: RiskEvaluationInput): RiskEvaluation {
  const flags: RiskEvaluation['flags'] = []

  if (!input.hasEnoughGas) {
    flags.push('gas')
  }

  if (input.priceImpactBps >= HIGH_PRICE_IMPACT_BPS) {
    flags.push('price-impact')
  }

  if (input.slippageBps >= ELEVATED_SLIPPAGE_BPS) {
    flags.push('slippage')
  }

  if (flags.includes('gas') || flags.includes('price-impact')) {
    return {
      level: 'high',
      flags,
    }
  }

  if (flags.length > 0) {
    return {
      level: 'medium',
      flags,
    }
  }

  return {
    level: 'low',
    flags,
  }
}
