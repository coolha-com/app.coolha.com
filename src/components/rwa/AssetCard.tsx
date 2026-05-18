import Link from 'next/link'
import type { RWAAsset } from '@/lib/rwa/types'
import { RiskScoreBadge } from './RiskScoreBadge'

function compactUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

export function AssetCard(props: { asset: RWAAsset }) {
  const { asset } = props
  return (
    <Link
      href={`/rwa/${asset.id}`}
      className="group block w-[320px] shrink-0 snap-start rounded-[26px] border border-border bg-card/95 p-4 shadow-sm backdrop-blur transition hover:border-primary/20 hover:bg-muted/40 md:w-[380px]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{asset.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {asset.protocol.name} · {asset.assetType}
          </p>
        </div>
        <RiskScoreBadge score={asset.riskScore} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl border border-border bg-background p-2">
          <p className="text-muted-foreground">APY</p>
          <p className="mt-1 text-foreground">{asset.apy.toFixed(2)}%</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-2">
          <p className="text-muted-foreground">TVL</p>
          <p className="mt-1 text-foreground">${compactUsd(asset.tvl)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-2">
          <p className="text-muted-foreground">流动性</p>
          <p className="mt-1 text-foreground">{asset.liquidityType === 'liquid' ? '可赎回' : '锁仓'}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-2">
          <p className="text-muted-foreground">到期</p>
          <p className="mt-1 text-foreground">{asset.maturityDate ?? '-'}</p>
        </div>
      </div>

      {asset.tags?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {asset.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  )
}
