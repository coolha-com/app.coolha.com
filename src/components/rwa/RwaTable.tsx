import Link from 'next/link'
import type { RWAAsset } from '@/lib/rwa/types'
import { RiskScoreBadge } from './RiskScoreBadge'

function compactUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

function liquidityLabel(asset: RWAAsset): string {
  if (asset.liquidityType === 'liquid') return '可赎回'
  return '锁仓'
}

export function RwaTable(props: { assets: RWAAsset[] }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-border bg-card/95 shadow-sm backdrop-blur">
      <div className="hidden grid-cols-[2.1fr_0.9fr_0.8fr_0.9fr_0.9fr_0.9fr_0.9fr] gap-3 border-b border-border bg-muted/20 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground md:grid">
        <p>资产</p>
        <p>协议</p>
        <p>APY</p>
        <p>风险</p>
        <p>流动性</p>
        <p>到期</p>
        <p>TVL</p>
      </div>

      <div className="divide-y divide-border/60">
        {props.assets.map((asset) => (
          <Link
            key={asset.id}
            href={`/rwa/${asset.id}`}
            className="block px-4 py-4 transition hover:bg-muted/25 md:px-5"
          >
            <div className="space-y-3 md:grid md:grid-cols-[2.1fr_0.9fr_0.8fr_0.9fr_0.9fr_0.9fr_0.9fr] md:items-center md:gap-3 md:space-y-0">
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3 md:block">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{asset.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {asset.protocol.name} · {asset.assetType}
                    </p>
                  </div>
                  <div className="md:hidden">
                    <RiskScoreBadge score={asset.riskScore} />
                  </div>
                </div>

                {asset.tags?.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5 md:mt-2">
                    {asset.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              <p className="hidden text-sm text-muted-foreground md:block">{asset.protocol.name}</p>

              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background px-3 py-2 md:block md:border-0 md:bg-transparent md:px-0 md:py-0">
                <span className="text-xs text-muted-foreground md:hidden">APY</span>
                <p className="font-medium text-primary">{asset.apy.toFixed(2)}%</p>
              </div>

              <div className="hidden items-center md:flex">
                <RiskScoreBadge score={asset.riskScore} />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background px-3 py-2 md:block md:border-0 md:bg-transparent md:px-0 md:py-0">
                <span className="text-xs text-muted-foreground md:hidden">流动性</span>
                <p className="text-sm text-muted-foreground">{liquidityLabel(asset)}</p>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background px-3 py-2 md:block md:border-0 md:bg-transparent md:px-0 md:py-0">
                <span className="text-xs text-muted-foreground md:hidden">到期</span>
                <p className="text-sm text-muted-foreground">{asset.maturityDate ?? '--'}</p>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-background px-3 py-2 md:block md:border-0 md:bg-transparent md:px-0 md:py-0">
                <span className="text-xs text-muted-foreground md:hidden">TVL</span>
                <p className="font-medium text-foreground">${compactUsd(asset.tvl)}</p>
              </div>
            </div>
          </Link>
        ))}

        {props.assets.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">没有匹配的资产。</div>
        ) : null}
      </div>
    </div>
  )
}
