import Link from 'next/link'
import type { ReactNode } from 'react'
import type { RWAAsset } from '@/lib/rwa/types'
import { RiskScoreBadge } from './RiskScoreBadge'

function compactUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

function Panel(props: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[24px] border border-border bg-card/95 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{props.title}</h3>
        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Top 5
        </span>
      </div>
      <div className="mt-3 space-y-2">{props.children}</div>
    </section>
  )
}

function Row(props: { asset: RWAAsset; meta: string }) {
  return (
    <Link
      href={`/rwa/${props.asset.id}`}
      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/80 px-3 py-3 text-sm text-foreground transition hover:border-primary/20 hover:bg-muted/40"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{props.asset.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {props.asset.protocol.name} · {props.asset.assetType}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{props.meta}</span>
        <RiskScoreBadge score={props.asset.riskScore} />
      </div>
    </Link>
  )
}

export function RankingPanel(props: { assets: RWAAsset[] }) {
  const byTvl = [...props.assets].sort((a, b) => b.tvl - a.tvl).slice(0, 5)
  const byApy = [...props.assets].sort((a, b) => b.apy - a.apy).slice(0, 5)
  const byRisk = [...props.assets].sort((a, b) => a.riskScore - b.riskScore).slice(0, 5)

  return (
    <div className="space-y-3">
      <section className="rounded-[28px] border border-border bg-card/95 p-5 shadow-sm backdrop-blur">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Market Snapshot</p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">排行榜与洞察</h2>
        <p className="mt-2 text-sm text-muted-foreground">辅助快速定位高 TVL、 高收益和低风险资产。</p>
      </section>
      <Panel title="热门资产（TVL）">
        {byTvl.map((asset) => (
          <Row key={asset.id} asset={asset} meta={`$${compactUsd(asset.tvl)}`} />
        ))}
      </Panel>
      <Panel title="收益最高">
        {byApy.map((asset) => (
          <Row key={asset.id} asset={asset} meta={`${asset.apy.toFixed(2)}%`} />
        ))}
      </Panel>
      <Panel title="风险最低">
        {byRisk.map((asset) => (
          <Row key={asset.id} asset={asset} meta={`${Math.round(asset.riskScore)}/100`} />
        ))}
      </Panel>
    </div>
  )
}
