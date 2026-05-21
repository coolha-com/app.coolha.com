'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type QuoteDetailsProps = {
  buyAmount?: string
  routeSummary?: string
  minBuyAmount?: string
  integratorFeeAmount?: string
  statusLabel?: string
}

export function QuoteDetails({
  buyAmount = '--',
  routeSummary = '--',
  minBuyAmount = '--',
  integratorFeeAmount = '--',
  statusLabel = 'Awaiting quote',
}: QuoteDetailsProps) {
  return (
    <Card className="gap-4 border border-border/60 bg-card/90 shadow-none backdrop-blur">
      <CardHeader className="gap-2">
        <CardTitle>Quote Details</CardTitle>
        <CardDescription>Price, route, and builder fee summary</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between rounded-3xl border border-border/70 bg-muted/20 px-4 py-3">
          <span className="text-muted-foreground">Expected receive</span>
          <span className="font-medium text-foreground">{buyAmount}</span>
        </div>
        <div className="flex items-center justify-between rounded-3xl border border-border/70 bg-muted/20 px-4 py-3">
          <span className="text-muted-foreground">Route</span>
          <span className="font-medium text-foreground">{routeSummary}</span>
        </div>
        <div className="flex items-center justify-between rounded-3xl border border-border/70 bg-muted/20 px-4 py-3">
          <span className="text-muted-foreground">Min received</span>
          <span className="font-medium text-foreground">{minBuyAmount}</span>
        </div>
        <div className="flex items-center justify-between rounded-3xl border border-border/70 bg-muted/20 px-4 py-3">
          <span className="text-muted-foreground">Builder fee</span>
          <span className="font-medium text-foreground">{integratorFeeAmount}</span>
        </div>
        <div className="rounded-[2rem] border border-dashed border-border/80 bg-muted/10 px-4 py-3 text-xs leading-6 text-muted-foreground">
          {statusLabel}
        </div>
      </CardContent>
    </Card>
  )
}
