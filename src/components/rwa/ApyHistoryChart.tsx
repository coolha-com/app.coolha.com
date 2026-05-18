import type { RwaaApyPoint } from '@/lib/rwa/types'

function pointsToPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return ''
  return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

export function ApyHistoryChart(props: { points: RwaaApyPoint[] }) {
  const values = props.points.map((p) => p.apy)
  const min = Math.min(...values, 0)
  const max = Math.max(...values, 1)
  const latest = props.points[props.points.length - 1]?.apy ?? 0
  const previous = props.points[props.points.length - 2]?.apy ?? latest
  const trend = latest - previous
  const w = 460
  const h = 150
  const pad = 18
  const safeRange = Math.max(0.0001, max - min)
  const pts = props.points.map((p, idx) => {
    const x = pad + (idx / Math.max(1, props.points.length - 1)) * (w - pad * 2)
    const y = pad + ((max - p.apy) / safeRange) * (h - pad * 2)
    return { x, y }
  })
  const areaPath = pts.length
    ? `${pointsToPath(pts)} L ${pts[pts.length - 1].x} ${h - pad} L ${pts[0].x} ${h - pad} Z`
    : ''

  return (
    <section className="rounded-[28px] border border-border bg-card/95 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Historical Performance</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">APY 变化折线图</h2>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">{latest.toFixed(2)}%</p>
          <p className={`text-xs ${trend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {trend >= 0 ? '+' : ''}
            {trend.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">最低 APY</p>
          <p className="mt-1 text-base font-semibold text-foreground">{min.toFixed(2)}%</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">最高 APY</p>
          <p className="mt-1 text-base font-semibold text-foreground">{max.toFixed(2)}%</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">观察周期</p>
          <p className="mt-1 text-base font-semibold text-foreground">{props.points.length} 期</p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[24px] border border-border bg-muted/15 p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <p>APY 历史轨迹</p>
          <p>
          {min.toFixed(2)}% → {max.toFixed(2)}%
          </p>
        </div>

        <div className="mt-3">
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="APY history">
            <defs>
              <linearGradient id="apyArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#7de3ff" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#7de3ff" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {[0, 1, 2, 3].map((line) => {
              const y = pad + (line / 3) * (h - pad * 2)
              return <line key={line} x1={pad} x2={w - pad} y1={y} y2={y} stroke="currentColor" className="text-border" strokeDasharray="4 4" />
            })}

            {areaPath ? <path d={areaPath} fill="url(#apyArea)" /> : null}
            <path d={pointsToPath(pts)} fill="none" stroke="#7de3ff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {pts.slice(-1).map((p, idx) => (
              <circle key={idx} cx={p.x} cy={p.y} r="4.5" fill="#7de3ff" />
          ))}
        </svg>
      </div>

        <div className="mt-2 flex justify-between gap-2 overflow-x-auto text-[11px] text-muted-foreground">
          {props.points.map((point) => (
            <span key={point.date} className="shrink-0">
              {point.date.slice(5, 7)} 月
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
