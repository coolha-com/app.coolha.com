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
    <Card className="gap-3 border border-border/60 bg-card/70 shadow-none backdrop-blur" size="sm">
      <CardHeader className="gap-1">
        <CardTitle>K 线图</CardTitle>
        <CardDescription>{pairLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid h-[280px] place-items-center rounded-[1.5rem] border border-dashed border-border/80 bg-muted/20 text-sm text-muted-foreground">
          图表占位区域
        </div>
      </CardContent>
    </Card>
  )
}
