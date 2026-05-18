"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { PortfolioSuggestion as PortfolioSuggestionType } from "@/lib/ai/aiService"

type PortfolioSuggestionProps = {
  portfolio: PortfolioSuggestionType
}

export function PortfolioSuggestion({ portfolio }: PortfolioSuggestionProps) {
  return (
    <Card className="rounded-[28px] border-border bg-card shadow-none">
      <CardHeader className="border-b border-border">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">AI Advisor</p>
            <CardTitle className="mt-2 text-foreground">{portfolio.strategy}</CardTitle>
            <CardDescription className="mt-2 text-muted-foreground">
              推荐 3 个 RWA 标的，按风险承受能力与收益目标进行 rule-based 配比。
            </CardDescription>
          </div>
          <div className="rounded-full border border-primary/25 bg-primary/15 px-3 py-1.5 text-sm font-medium text-primary">
            预期收益 {portfolio.expectedYield}%
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-6">
        {portfolio.items.map((item) => (
          <article key={item.assetId} className="rounded-[24px] border border-border bg-background/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{item.assetName}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.thesis}</p>
              </div>
              <span className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground">
                占比 {item.weight}%
              </span>
            </div>
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${item.weight}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>预期收益</span>
                <span>{item.expectedYield}%</span>
              </div>
            </div>
          </article>
        ))}
      </CardContent>
    </Card>
  )
}
