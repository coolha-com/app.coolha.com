import type { RWAAssetDetail } from '@/lib/rwa/types'
import { FundFlowChart } from './FundFlowChart'

function compact(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

export function FundFlow(props: { detail: RWAAssetDetail }) {
  const points = props.detail.fundFlow.points
  const totalIn = points.reduce((sum, p) => sum + p.inflow, 0)
  const totalOut = points.reduce((sum, p) => sum + p.outflow, 0)
  const net = totalIn - totalOut

  return (
    <section className="rounded-[28px] border border-border bg-card/95 p-5 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">On-chain Flow</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">资金流与可视化</h2>
        </div>
        <div className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
          In {compact(totalIn)} · Out {compact(totalOut)} · Net {net >= 0 ? '+' : ''}
          {compact(net)}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">累计流入</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{compact(totalIn)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">累计流出</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{compact(totalOut)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">净流向</p>
          <p className={`mt-1 text-lg font-semibold ${net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {net >= 0 ? '+' : ''}
            {compact(net)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <FundFlowChart series={props.detail.fundFlow} />

        <div className="rounded-[24px] border border-border bg-muted/15 p-4">
          <p className="text-sm font-semibold text-foreground">资金流可视化</p>
          <p className="mt-1 text-xs text-muted-foreground">使用列表形式模拟 Sankey，将每期的流入与流出拆成节点。</p>

          <div className="mt-3 space-y-2 text-sm">
            {points.slice(0, 6).map((p) => {
              const itemNet = p.inflow - p.outflow
              return (
                <div key={p.label} className="rounded-2xl border border-border bg-background px-3 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{p.label}</span>
                    <span className={itemNet >= 0 ? 'text-emerald-500' : 'text-rose-500'}>{itemNet >= 0 ? `+${itemNet}` : `${itemNet}`}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Inflow: {p.inflow}</span>
                    <span>Outflow: {p.outflow}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
