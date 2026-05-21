'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type QuoteDetailsProps = {
  routeSummary?: string
  minBuyAmount?: string
  integratorFeeAmount?: string
}

export function QuoteDetails({
  routeSummary = '--',
  minBuyAmount = '--',
  integratorFeeAmount = '--',
}: QuoteDetailsProps) {
  return (
    <Card className="gap-4 border border-border/60 bg-card/90 shadow-none backdrop-blur">
      <CardHeader className="gap-2">
        <CardTitle>Quote Details</CardTitle>
        <CardDescription>Price, route, and builder fee summary</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
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
      </CardContent>
    </Card>
  )
}
