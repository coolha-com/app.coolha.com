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
  feeConfigLabel?: string
  statusLabel?: string
}

export function QuoteDetails({
  buyAmount = '--',
  routeSummary = '--',
  minBuyAmount = '--',
  integratorFeeAmount = '--',
  feeConfigLabel = 'Builder Fee 状态不可用',
  statusLabel = '等待报价',
}: QuoteDetailsProps) {
  return (
    <Card className="gap-3 border border-border/60 bg-card/70 shadow-none backdrop-blur" size="sm">
      <CardHeader className="gap-1">
        <CardTitle>报价详情</CardTitle>
        <CardDescription>路由、最小到账和手续费</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center justify-between rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3">
          <span className="text-muted-foreground">预计到账</span>
          <span className="font-medium text-foreground">{buyAmount}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3 sm:block">
            <span className="text-muted-foreground">路由</span>
            <div className="mt-1 font-medium text-foreground">{routeSummary}</div>
          </div>
          <div className="flex items-center justify-between rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3 sm:block">
            <span className="text-muted-foreground">最少到账</span>
            <div className="mt-1 font-medium text-foreground">{minBuyAmount}</div>
          </div>
          <div className="flex items-center justify-between rounded-[1.25rem] border border-border/70 bg-muted/20 px-4 py-3 sm:block">
            <span className="text-muted-foreground">Builder Fee</span>
            <div className="mt-1 font-medium text-foreground">{integratorFeeAmount}</div>
          </div>
        </div>
        <div className="rounded-[1.25rem] border border-dashed border-border/80 bg-muted/10 px-4 py-3 text-xs leading-6 text-muted-foreground">
          {statusLabel}
        </div>
        <div className="rounded-[1.25rem] border border-dashed border-border/80 bg-muted/10 px-4 py-3 text-xs leading-6 text-muted-foreground">
          {feeConfigLabel}
        </div>
      </CardContent>
    </Card>
  )
}
