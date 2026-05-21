'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type TradingViewPanelProps = {
  pairLabel?: string
}

export function TradingViewPanel({ pairLabel = 'HYPE / USDC' }: TradingViewPanelProps) {
  return (
    <Card className="gap-4 border border-border/60 bg-card/90 shadow-none backdrop-blur">
      <CardHeader className="gap-2">
        <CardTitle>Chart</CardTitle>
        <CardDescription>{pairLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid h-[360px] place-items-center rounded-[2rem] border border-dashed border-border/80 bg-muted/20 text-sm text-muted-foreground">
          Trading view panel placeholder
        </div>
      </CardContent>
    </Card>
  )
}
