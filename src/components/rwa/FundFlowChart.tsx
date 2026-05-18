import type { RWAFlowSeries } from '@/lib/rwa/types'

export function FundFlowChart(props: { series: RWAFlowSeries }) {
  const maxValue = Math.max(
    1,
    ...props.series.points.flatMap((p) => [p.inflow, p.outflow]),
  )

  return (
    <div className="rounded-[24px] border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">链上资金流（mock）</p>
          <p className="mt-1 text-xs text-muted-foreground">单位：{props.series.unit}</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Inflow
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            Outflow
          </span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-3 sm:grid-cols-8">
        {props.series.points.map((p) => {
          const inflowH = Math.max(10, Math.round((p.inflow / maxValue) * 96))
          const outflowH = Math.max(10, Math.round((p.outflow / maxValue) * 96))
          return (
            <div key={p.label} className="rounded-2xl border border-border bg-muted/15 p-3">
              <div className="flex h-[112px] items-end justify-center gap-2">
                <div className="w-4 rounded-t-md bg-emerald-400/85" style={{ height: `${inflowH}px` }} />
                <div className="w-4 rounded-t-md bg-rose-400/85" style={{ height: `${outflowH}px` }} />
              </div>
              <div className="mt-3 text-center">
                <p className="text-[11px] font-medium text-foreground">{p.label}</p>
                <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                  <p>In {p.inflow}</p>
                  <p>Out {p.outflow}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
