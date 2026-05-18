'use client'

import { useMemo, useState } from 'react'
import type { RWAAsset, RWAFilter, RWAProtocol } from '@/lib/rwa/types'
import { AssetCard } from './AssetCard'
import { FilterBar } from './FilterBar'
import { RankingPanel } from './RankingPanel'
import { RwaTable } from './RwaTable'

const EMPTY_FILTER: RWAFilter = {
  apyMin: undefined,
  apyMax: undefined,
  riskLevels: [],
  assetTypes: [],
  liquidityTypes: [],
  liquidity: [],
  protocols: [],
}

function applyFilter(assets: RWAAsset[], filter: RWAFilter): RWAAsset[] {
  return assets.filter((asset) => {
    if (filter.apyMin !== undefined && asset.apy < filter.apyMin) return false
    if (filter.apyMax !== undefined && asset.apy > filter.apyMax) return false
    if (filter.riskLevels.length && !filter.riskLevels.includes(asset.riskLevel)) return false
    if (filter.assetTypes.length && !filter.assetTypes.includes(asset.assetType)) return false
    if (filter.liquidityTypes.length && !filter.liquidityTypes.includes(asset.liquidityType)) return false
    if (filter.liquidity.length && !filter.liquidity.includes(asset.liquidity)) return false
    if (filter.protocols.length && !filter.protocols.includes(asset.protocol.id)) return false
    return true
  })
}

function compactUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

export function RwaMarketplace(props: { assets: RWAAsset[]; protocols: RWAProtocol[] }) {
  const [filter, setFilter] = useState<RWAFilter>(EMPTY_FILTER)
  const filteredAssets = useMemo(() => applyFilter(props.assets, filter), [props.assets, filter])
  const marketTvl = props.assets.reduce((sum, asset) => sum + asset.tvl, 0)
  const avgApy = props.assets.reduce((sum, asset) => sum + asset.apy, 0) / Math.max(1, props.assets.length)
  const lowRiskCount = props.assets.filter((asset) => asset.riskLevel === 'low').length

  return (
    <main className="min-h-[calc(100dvh-120px)] w-full bg-background px-4 py-5 md:px-6 md:py-7">
      <section className="mx-auto w-full max-w-7xl space-y-5">
        <header className="rounded-[28px] border border-border bg-card/95 p-5 shadow-sm backdrop-blur md:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">RWA Marketplace</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">Discover tokenized yield markets</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                聚合 Ondo、Centrifuge、Maple 等协议的 mock RWA 数据，面向 Router 接入和 AI 风险评估预留扩展结构。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[22px] border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">Assets</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{props.assets.length}</p>
              </div>
              <div className="rounded-[22px] border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">Market TVL</p>
                <p className="mt-2 text-xl font-semibold text-foreground">${compactUsd(marketTvl)}</p>
              </div>
              <div className="rounded-[22px] border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">Avg APY</p>
                <p className="mt-2 text-xl font-semibold text-foreground">{avgApy.toFixed(2)}%</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
              Low risk assets {lowRiskCount}
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
              Mock data only
            </span>
            <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
              Router-ready architecture
            </span>
          </div>
        </header>

        <FilterBar filter={filter} protocols={props.protocols} onChange={setFilter} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 space-y-5">
            <div className="overflow-x-auto pb-1">
              <div className="flex snap-x gap-3">
                {filteredAssets.slice(0, 4).map((asset) => (
                  <AssetCard key={asset.id} asset={asset} />
                ))}
              </div>
            </div>
            <RwaTable assets={filteredAssets} />
          </section>

          <aside className="min-w-0">
            <RankingPanel assets={props.assets} />
          </aside>
        </div>
      </section>
    </main>
  )
}
