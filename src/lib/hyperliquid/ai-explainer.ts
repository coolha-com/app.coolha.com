import type { RiskFlag, TradeInsight, TradeInsightInput } from './types'

const RISK_FLAG_LABELS: Record<RiskFlag, string> = {
  gas: 'Gas 准备不足',
  'price-impact': '价格冲击偏高',
  slippage: '滑点容忍偏高',
}

function formatRiskFlags(riskFlags: RiskFlag[]): string {
  return riskFlags.map((flag) => RISK_FLAG_LABELS[flag]).join('、')
}

export function buildTradeInsight(input: TradeInsightInput): TradeInsight {
  const summary = `本次交易会把 ${input.sellSymbol} 兑换成 ${input.buySymbol}，预计到账 ${input.receiveAmount} ${input.buySymbol}。`

  const warning =
    input.riskFlags.length > 0
      ? `当前风险点：${formatRiskFlags(input.riskFlags)}。请结合链上流动性、Gas 和滑点设置自行确认。`
      : '当前未发现明显的结构性风险信号，但你仍需自行确认流动性、滑点与链上执行成本。'

  const suggestion =
    input.riskLevel === 'high'
      ? '当前更偏激进，建议先缩小单笔金额，或等待更稳定的流动性后再执行。'
      : input.riskLevel === 'medium'
        ? '如果你偏保守，可以考虑分批执行，并适度收紧滑点容忍范围。'
        : '如果你偏保守，也可以继续观察成交路径与市场波动，再决定是否分批执行。'

  return {
    summary,
    warning,
    suggestion,
  }
}
