'use client'

import { useMemo } from 'react'
import { useAccount } from 'wagmi'
import { aggregateMockPortfolio, type PortfolioDistributionItem, type PortfolioSnapshot } from '@/lib/portfolio/portfolioService'

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(value)
}

function DistributionBars(props: { title: string; items: PortfolioDistributionItem[] }) {
  return (
    <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{props.title}</h2>
      <div className="mt-4 space-y-3">
        {props.items.map((item) => (
          <div key={item.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-foreground">{item.label}</span>
              <span className="text-muted-foreground">{item.percentage}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${item.percentage}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{formatUsd(item.valueUsd)}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function YieldTrend(props: { portfolio: PortfolioSnapshot }) {
  const points = props.portfolio.yieldTrend
  const min = Math.min(...points.map((point) => point.valueUsd))
  const max = Math.max(...points.map((point) => point.valueUsd))
  const w = 520
  const h = 160
  const pad = 18
  const range = Math.max(1, max - min)
  const path = points
    .map((point, index) => {
      const x = pad + (index / Math.max(1, points.length - 1)) * (w - pad * 2)
      const y = pad + ((max - point.valueUsd) / range) * (h - pad * 2)
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  return (
    <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Yield Trend</p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">收益趋势</h2>
        </div>
        <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
          Today {formatUsd(props.portfolio.todayYieldUsd)}
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-[24px] border border-border bg-background p-4">
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Portfolio yield trend">
          {[0, 1, 2, 3].map((line) => {
            const y = pad + (line / 3) * (h - pad * 2)
            return <line key={line} x1={pad} x2={w - pad} y1={y} y2={y} stroke="currentColor" className="text-border" strokeDasharray="4 4" />
          })}
          <path d={path} fill="none" stroke="#c0e218" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        </svg>
      </div>
    </section>
  )
}

export default function PortfolioPage() {
  const { address, isConnected } = useAccount()
  const portfolio = useMemo(() => aggregateMockPortfolio(address), [address])

  return (
    <main className="min-h-[calc(100dvh-120px)] w-full bg-background px-4 py-5 md:px-6 md:py-7">
      <section className="mx-auto w-full max-w-7xl space-y-5">
        <header className="rounded-[28px] border border-border bg-card p-5 shadow-sm md:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr] lg:items-end">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Portfolio</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">RWA holdings dashboard</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {isConnected ? `Connected wallet ${address}` : 'Wallet not connected. Showing protocol aggregation mock data.'}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">总资产</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{formatUsd(portfolio.totalBalanceUsd)}</p>
              </div>
              <div className="rounded-[22px] border border-border bg-background p-4">
                <p className="text-xs text-muted-foreground">今日收益</p>
                <p className="mt-2 text-2xl font-semibold text-primary">{formatUsd(portfolio.todayYieldUsd)}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 space-y-5">
            <section className="overflow-hidden rounded-[28px] border border-border bg-card shadow-sm">
              <div className="grid grid-cols-[1.6fr_0.7fr_0.8fr_0.7fr_0.9fr] gap-3 border-b border-border bg-muted/20 px-5 py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <p>Asset name</p>
                <p>Amount</p>
                <p>Value</p>
                <p>APY</p>
                <p>Maturity</p>
              </div>
              <div className="divide-y divide-border">
                {portfolio.holdings.map((holding) => (
                  <article key={holding.id} className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[1.6fr_0.7fr_0.8fr_0.7fr_0.9fr] md:items-center">
                    <div>
                      <p className="font-medium text-foreground">{holding.assetName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {holding.protocol} · {holding.assetType} · risk {holding.riskScore}/100
                      </p>
                    </div>
                    <p className="text-muted-foreground">{formatNumber(holding.amount)}</p>
                    <p className="font-medium text-foreground">{formatUsd(holding.valueUsd)}</p>
                    <p className="text-primary">{holding.apy.toFixed(2)}%</p>
                    <p className="text-muted-foreground">{holding.maturityDate ?? '--'}</p>
                  </article>
                ))}
              </div>
            </section>

            <YieldTrend portfolio={portfolio} />
          </section>

          <aside className="space-y-5">
            <DistributionBars title="按资产类型" items={portfolio.distributionByAssetType} />
            <DistributionBars title="按协议" items={portfolio.distributionByProtocol} />

            <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Risk Exposure</p>
              <h2 className="mt-2 text-lg font-semibold text-foreground">风险敞口</h2>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-2xl border border-border bg-background p-3">
                  <p className="text-muted-foreground">高风险</p>
                  <p className="mt-2 text-lg font-semibold text-rose-500">{portfolio.riskExposure.highRiskRatio}%</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-3">
                  <p className="text-muted-foreground">中风险</p>
                  <p className="mt-2 text-lg font-semibold text-amber-500">{portfolio.riskExposure.mediumRiskRatio}%</p>
                </div>
                <div className="rounded-2xl border border-border bg-background p-3">
                  <p className="text-muted-foreground">低风险</p>
                  <p className="mt-2 text-lg font-semibold text-emerald-500">{portfolio.riskExposure.lowRiskRatio}%</p>
                </div>
              </div>
              <p className="mt-4 rounded-[20px] border border-border bg-background p-3 text-sm leading-6 text-muted-foreground">
                {portfolio.riskExposure.aiHint}
              </p>
              <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                {portfolio.dataSources.map((source) => (
                  <p key={source}>{source}</p>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  )
}
