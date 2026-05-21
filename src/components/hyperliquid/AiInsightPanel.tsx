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
  gas: 'Low Gas',
  'price-impact': 'Price Impact',
  slippage: 'Slippage',
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
  summary = 'AI explanation will summarize the selected trade here.',
  warning = 'Risk checks will appear after a quote is requested.',
  suggestion = 'Use this panel for informative guidance only.',
  statusLabel = 'Waiting for quote context.',
  riskItems = [],
  disclaimerLabel = 'AI content is for interface assistance only and never replaces your own judgment, wallet confirmation, or legal review.',
}: AiInsightPanelProps) {
  return (
    <Card className="gap-4 border border-border/60 bg-card/90 shadow-none backdrop-blur">
      <CardHeader className="gap-2">
        <CardTitle>AI Insight</CardTitle>
        <CardDescription>Assistive explanation with explicit risk context</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RiskBadges items={riskItems.length ? riskItems.map((item) => RISK_LABELS[item]) : ['Monitoring quote state']} />
        <div className="space-y-2 rounded-[2rem] border border-border/70 bg-muted/20 p-4 text-sm">
          <p className="font-medium text-foreground">{summary}</p>
          <p className="text-muted-foreground">{warning}</p>
          <p className="text-muted-foreground">{suggestion}</p>
        </div>
        <div className="rounded-[2rem] border border-border/70 bg-muted/20 p-4 text-xs leading-6 text-muted-foreground">
          {statusLabel}
        </div>
        <div className="rounded-[2rem] border border-dashed border-border/80 bg-muted/10 p-4 text-xs leading-6 text-muted-foreground">
          {disclaimerLabel}
        </div>
      </CardContent>
    </Card>
  )
}
