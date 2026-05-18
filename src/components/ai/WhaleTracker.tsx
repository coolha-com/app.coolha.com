"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export type WhaleTrade = {
  wallet: string
  asset: string
  action: "Buy" | "Sell" | "Rotate"
  amount: string
  flow: string
  riskHint: string
}

type WhaleTrackerProps = {
  trades: WhaleTrade[]
}

const actionTone: Record<WhaleTrade["action"], string> = {
  Buy: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Sell: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
  Rotate: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
}

export function WhaleTracker({ trades }: WhaleTrackerProps) {
  return (
    <Card className="rounded-[28px] border-border bg-card shadow-none">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-foreground">Whale Tracker</CardTitle>
        <CardDescription className="text-muted-foreground">
          跟踪大户交易记录、资金流变化与即时风险提示，当前全部为 mock 数据。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-6">
        {trades.map((trade) => (
          <article key={`${trade.wallet}-${trade.asset}`} className="rounded-[24px] border border-border bg-background/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{trade.asset}</p>
                <p className="mt-1 text-xs text-muted-foreground">{trade.wallet}</p>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs ${actionTone[trade.action]}`}>{trade.action}</div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">交易规模</p>
                <p className="mt-2 text-sm text-foreground">{trade.amount}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">资金流变化</p>
                <p className="mt-2 text-sm text-foreground">{trade.flow}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{trade.riskHint}</p>
          </article>
        ))}
      </CardContent>
    </Card>
  )
}
