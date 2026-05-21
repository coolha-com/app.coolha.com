'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { RiskBadges } from './RiskBadges'

type AiInsightPanelProps = {
  summary?: string
  warning?: string
  suggestion?: string
}

export function AiInsightPanel({
  summary = 'AI explanation will summarize the selected trade here.',
  warning = 'Risk checks will appear after a quote is requested.',
  suggestion = 'Use this panel for informative guidance only.',
}: AiInsightPanelProps) {
  return (
    <Card className="gap-4 border border-border/60 bg-card/90 shadow-none backdrop-blur">
      <CardHeader className="gap-2">
        <CardTitle>AI Insight</CardTitle>
        <CardDescription>Assistive explanation with explicit risk context</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RiskBadges />
        <div className="space-y-2 rounded-[2rem] border border-border/70 bg-muted/20 p-4 text-sm">
          <p className="font-medium text-foreground">{summary}</p>
          <p className="text-muted-foreground">{warning}</p>
          <p className="text-muted-foreground">{suggestion}</p>
        </div>
        <div className="rounded-[2rem] border border-dashed border-border/80 bg-muted/10 p-4 text-xs leading-6 text-muted-foreground">
          AI content is for interface assistance only and never replaces your wallet confirmation.
        </div>
      </CardContent>
    </Card>
  )
}
