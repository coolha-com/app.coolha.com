"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { AssetAlert } from "@/lib/ai/alertEngine"

type LiquidationAlertProps = {
  alerts: AssetAlert[]
}

const severityTone: Record<AssetAlert["severity"], string> = {
  low: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  medium: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  high: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
}

const typeLabel: Record<AssetAlert["type"], string> = {
  risk_change: "风险变化",
  yield_change: "收益变化",
  abnormal_event: "异常事件",
}

export function LiquidationAlert({ alerts }: LiquidationAlertProps) {
  return (
    <Card className="rounded-[28px] border-border bg-card shadow-none">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-foreground">Liquidation Alert</CardTitle>
        <CardDescription className="text-muted-foreground">
          聚合风险变化、收益变化与异常事件，并模拟自动跟踪系统的推送结果。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-6">
        {alerts.map((alert) => (
          <article key={alert.id} className="rounded-[24px] border border-border bg-background/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{alert.assetName}</span>
                  <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
                    {typeLabel[alert.type]}
                  </span>
                </div>
                <p className="mt-2 text-sm text-foreground">{alert.title}</p>
              </div>
              <div className={`rounded-full border px-3 py-1 text-xs ${severityTone[alert.severity]}`}>{alert.delta}</div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{alert.message}</p>
          </article>
        ))}
      </CardContent>
    </Card>
  )
}
