'use client'

import { useMemo, useState } from 'react'
import { FilterBar } from '@/components/rwa/FilterBar'
import { RankingPanel } from '@/components/rwa/RankingPanel'
import { RwaTable } from '@/components/rwa/RwaTable'
import { RWA_ASSETS, RWA_PROTOCOLS } from '@/lib/rwa/mockData'
import type { RWAFilter } from '@/lib/rwa/types'

function compactUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

export default function RwaPage() {
  const [filter, setFilter] = useState<RWAFilter>({
    apyMin: undefined,
    apyMax: undefined,
    riskLevels: [],
    assetTypes: [],
    liquidityTypes: [],
    liquidity: [],
    protocols: [],
  })

  const protocols = useMemo(() => Object.values(RWA_PROTOCOLS), [])
  const activeFilterCount =
    filter.riskLevels.length +
    filter.assetTypes.length +
    filter.liquidityTypes.length +
    filter.liquidity.length +
    filter.protocols.length +
    (filter.apyMin !== undefined ? 1 : 0) +
    (filter.apyMax !== undefined ? 1 : 0)

  const filtered = useMemo(() => {
    return RWA_ASSETS.filter((asset) => {
      if (filter.apyMin !== undefined && asset.apy < filter.apyMin) return false
      if (filter.apyMax !== undefined && asset.apy > filter.apyMax) return false
      if (filter.riskLevels.length && !filter.riskLevels.includes(asset.riskLevel)) return false
      if (filter.assetTypes.length && !filter.assetTypes.includes(asset.assetType)) return false
      if (filter.liquidityTypes.length && !filter.liquidityTypes.includes(asset.liquidityType)) return false
      if (filter.liquidity.length && !filter.liquidity.includes(asset.liquidity)) return false
      if (filter.protocols.length && !filter.protocols.includes(asset.protocol.id)) return false
      return true
    })
  }, [filter])

  const summary = useMemo(() => {
    const totalTvl = filtered.reduce((sum, asset) => sum + asset.tvl, 0)
    const avgApy = filtered.length ? filtered.reduce((sum, asset) => sum + asset.apy, 0) / filtered.length : 0
    const liquidCount = filtered.filter((asset) => asset.liquidityType === 'liquid').length
    return { totalTvl, avgApy, liquidCount }
  }, [filtered])

  return (
    <main className="min-h-[calc(100dvh-120px)] w-full bg-background px-3 py-3 text-foreground md:px-5 md:py-5">
      <section className="w-full space-y-5">
        <section className="rounded-[24px] border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                Test Environment
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">当前页面处于模拟测试环境</p>
              <p className="mt-1 text-sm text-muted-foreground">
                当前展示的数据、收益率、风险分与路由结果均为 mock / demo 内容，仅用于产品交互演示，不代表真实市场情况。
              </p>
            </div>
            <div className="rounded-full border border-amber-500/30 bg-background/80 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300">
              数据可能不准确
            </div>
          </div>
        </section>

        <header className="overflow-hidden rounded-[32px] border border-border bg-card/95 p-5 shadow-sm backdrop-blur md:p-6">
          <div className="grid gap-5 xl:grid-cols-[1.35fr_0.95fr]">
            <div className="space-y-4">

              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-4xl">RWA Marketplace</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  把筛选、浏览和决策浓缩在一个工作台里，先收敛条件，再在高信息密度列表中比较 APY、风险、期限与流动性。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                  非托管前端聚合
                </span>
                <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                  Router 执行（Mock）
                </span>
                <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                  多协议可扩展
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <div className="rounded-[24px] border border-border bg-background/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">匹配资产</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">{filtered.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">当前筛选范围内可浏览标的</p>
              </div>
              <div className="rounded-[24px] border border-border bg-background/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">总 TVL</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">${compactUsd(summary.totalTvl)}</p>
                <p className="mt-1 text-xs text-muted-foreground">筛选结果累计资产规模</p>
              </div>
              <div className="rounded-[24px] border border-border bg-background/80 p-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">平均 APY</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">{summary.avgApy.toFixed(2)}%</p>
                <p className="mt-1 text-xs text-muted-foreground">其中可赎回资产 {summary.liquidCount} 个</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_360px]">
          <div className="space-y-4">
            <section className="rounded-[32px] border border-border bg-card/95 p-4 shadow-sm backdrop-blur md:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Workspace</p>
                  <h2 className="mt-1 text-lg font-semibold text-foreground md:text-xl">资产探索器</h2>
                  <p className="mt-2 text-sm text-muted-foreground">筛选与列表整合在同一工作流里，减少来回切换与扫视成本。</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs text-foreground">
                    已筛选 {activeFilterCount} 项
                  </span>
                  <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                    字段：APY / 风险 / 流动性 / 到期 / TVL
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <FilterBar filter={filter} protocols={protocols} onChange={setFilter} />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-border bg-muted/15 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">结果列表</p>
                  <p className="mt-1 text-xs text-muted-foreground">桌面端采用高密度行式布局，移动端自动切换为分块卡片。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                    {filtered.length} / {RWA_ASSETS.length} 个结果
                  </span>
                  <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                    {filtered.length ? '可立即比较' : '等待调整筛选'}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <RwaTable assets={filtered} />
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <RankingPanel assets={filtered.length ? filtered : RWA_ASSETS} />
     
          </aside>
        </section>
      </section>
    </main>
  )
}
