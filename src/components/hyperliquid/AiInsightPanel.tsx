'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { RiskBadges } from './RiskBadges'
import type { RiskFlag } from '@/lib/hyperliquid/types'

const RISK_LABELS: Record<RiskFlag, string> = {
  gas: 'Gas 不足',
  'price-impact': '价格冲击',
  slippage: '滑点偏高',
}

type AiInsightPanelProps = {
  summary?: string
  warning?: string
  suggestion?: string
  statusLabel?: string
  riskItems?: RiskFlag[]
  disclaimerLabel?: string
}

export function AiInsightPanel({
  summary = 'AI 会在这里总结当前交易的含义。',
  warning = '获取报价后，这里会显示风险提示。',
  suggestion = '此面板仅提供辅助说明，不代替你自己的判断。',
  statusLabel = '等待报价上下文。',
  riskItems = [],
  disclaimerLabel = 'AI 内容仅用于界面辅助说明，不替代你的独立判断、钱包确认或合规审查。',
}: AiInsightPanelProps) {
  return (
    <Card className="gap-3 border border-border/60 bg-card/70 shadow-none backdrop-blur" size="sm">
      <CardHeader className="gap-1">
        <CardTitle>AI 解读</CardTitle>
        <CardDescription>交易解释与风险上下文</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <RiskBadges items={riskItems.length ? riskItems.map((item) => RISK_LABELS[item]) : ['等待报价']} />
        <div className="space-y-2 rounded-[1.25rem] border border-border/70 bg-muted/20 p-4 text-sm">
          <p className="font-medium text-foreground">{summary}</p>
          <p className="text-muted-foreground">{warning}</p>
          <p className="text-muted-foreground">{suggestion}</p>
        </div>
        <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 p-4 text-xs leading-6 text-muted-foreground">
          {statusLabel}
        </div>
        <div className="rounded-[1.25rem] border border-dashed border-border/80 bg-muted/10 p-4 text-xs leading-6 text-muted-foreground">
          {disclaimerLabel}
        </div>
      </CardContent>
    </Card>
  )
}
