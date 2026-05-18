import Link from 'next/link'
import type { RWAAsset } from '@/lib/rwa/types'
import { RiskScoreBadge } from './RiskScoreBadge'

function compactUsd(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

export function AssetHeader(props: { asset: RWAAsset }) {
  const { asset } = props
  return (
    <header className="overflow-hidden rounded-[32px] border border-border bg-card/95 p-5 shadow-sm backdrop-blur md:p-6">
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.95fr]">
        <div className="min-w-0 space-y-4">
          <Link href="/find/rwa" className="inline-flex rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition hover:text-foreground">
            ← 返回 RWA Marketplace
          </Link>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {asset.protocol.name}
              </span>
              <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {asset.assetType}
              </span>
              <span className="rounded-full border border-border bg-background px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {asset.liquidityType === 'liquid' ? '可赎回' : '锁仓'}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">{asset.name}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              {asset.description ?? '当前资产为 mock RWA 项目，用于演示不同协议来源、收益结构、风险分层与路由交易能力。'}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-border bg-background/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">项目介绍</p>
              <p className="mt-3 text-sm font-medium text-foreground">
                {asset.tags?.[0] ?? 'RWA Yield'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">用于说明底层资产敞口与收益来源。</p>
            </div>
            <div className="rounded-[24px] border border-border bg-background/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">收益率 APY</p>
              <p className="mt-3 text-2xl font-semibold text-foreground">{asset.apy.toFixed(2)}%</p>
              <p className="mt-1 text-xs text-muted-foreground">当前 mock 年化收益水平</p>
            </div>
            <div className="rounded-[24px] border border-border bg-background/80 p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">协议来源</p>
              <p className="mt-3 text-sm font-medium text-foreground">{asset.protocol.name}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{asset.protocol.website ?? 'Protocol Source'}</p>
            </div>
          </div>

          {asset.tags?.length ? (
            <div className="flex flex-wrap gap-2">
              {asset.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-border bg-muted/20 px-2.5 py-1 text-xs text-muted-foreground">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="rounded-[28px] border border-border bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">AI Risk Snapshot</p>
                <h2 className="mt-1 text-lg font-semibold text-foreground">核心指标摘要</h2>
              </div>
              <RiskScoreBadge score={asset.riskScore} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">TVL</p>
                <p className="mt-1 text-base font-semibold text-foreground">${compactUsd(asset.tvl)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">到期日</p>
                <p className="mt-1 text-base font-semibold text-foreground">{asset.maturityDate ?? '--'}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">链 ID</p>
                <p className="mt-1 text-base font-semibold text-foreground">{asset.chainId ?? '--'}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-3">
                <p className="text-xs text-muted-foreground">流动性</p>
                <p className="mt-1 text-base font-semibold text-foreground">{asset.liquidity === 'high' ? 'High' : 'Low'}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-amber-500/25 bg-amber-500/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Mock Disclaimer</p>
            <p className="mt-2 text-sm text-muted-foreground">
              当前详情页中的收益、资金流、历史表现与交易结果均为测试数据，仅用于演示未来接入真实 RWA 协议后的 UI 结构。
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
