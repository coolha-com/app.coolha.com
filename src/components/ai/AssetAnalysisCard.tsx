"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { AssetAnalysis } from "@/lib/ai/aiService"

type AssetAnalysisCardProps = {
  analysis: AssetAnalysis
}

function riskTone(level: AssetAnalysis["risk"]["level"]) {
  if (level === "High") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
  if (level === "Medium") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
}

export function AssetAnalysisCard({ analysis }: AssetAnalysisCardProps) {
  return (
    <Card className="overflow-hidden rounded-[28px] border-border bg-card shadow-none">
      <CardHeader className="border-b border-border">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Asset Analysis</p>
            <CardTitle className="mt-2 text-xl text-foreground">{analysis.asset.name}</CardTitle>
            <CardDescription className="mt-2 max-w-2xl text-muted-foreground">
              {analysis.aiSummary}
            </CardDescription>
          </div>
          <div className={cn("rounded-full border px-3 py-1.5 text-sm font-medium", riskTone(analysis.risk.level))}>
            风险评分 {analysis.risk.score} / 100
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 pt-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[24px] border border-border bg-background/70 p-4">
          <h3 className="text-sm font-medium text-foreground">收益来源拆解</h3>
          <div className="mt-4 space-y-3">
            {analysis.incomeBreakdown.map((item, index) => (
              <div key={item} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">{item}</span>
                  <span className="rounded-full border border-primary/25 bg-primary/15 px-2.5 py-1 text-[11px] text-primary">
                    Mock {index + 1}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <h3 className="text-sm font-medium text-foreground">结构解析</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                结构: {analysis.asset.structure}
              </span>
              <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
                底层: {analysis.asset.underlying}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {analysis.structureNotes.map((note) => (
                <p key={note} className="rounded-2xl border border-border bg-card p-3 text-sm leading-6 text-muted-foreground">
                  {note}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-border bg-background/70 p-4">
            <h3 className="text-sm font-medium text-foreground">AI 风险说明</h3>
            <p className="mt-3 text-sm text-muted-foreground">{analysis.risk.summary}</p>
            <div className="mt-4 space-y-2">
              {analysis.risk.drivers.map((driver) => (
                <div key={driver} className="rounded-2xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                  {driver}
                </div>
              ))}
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  )
}
