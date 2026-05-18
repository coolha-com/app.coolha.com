import { notFound } from 'next/navigation'
import { ApyHistoryChart } from '@/components/rwa/ApyHistoryChart'
import { AssetHeader } from '@/components/rwa/AssetHeader'
import { FundFlow } from '@/components/rwa/FundFlow'
import { RiskPanel } from '@/components/rwa/RiskPanel'
import { TradePanel } from '@/components/rwa/TradePanel'
import { getRwaDetailById } from '@/lib/rwa/mockData'

function formatMetadata(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (Array.isArray(value)) return value.join(', ')
  if (value === null || value === undefined) return '--'
  return JSON.stringify(value)
}

export default async function RwaDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const detail = getRwaDetailById(id)
  if (!detail) notFound()

  return (
    <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-3 text-foreground md:px-5 md:py-5">
      <section className="mx-auto max-w-7xl space-y-4">
        <AssetHeader asset={detail.asset} />

        <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <div className="space-y-4">
            <RiskPanel asset={detail.asset} />
            <ApyHistoryChart points={detail.apyHistory} />
            <FundFlow detail={detail} />
          </div>

          <div className="space-y-4">
            <TradePanel asset={detail.asset} />

            <section className="rounded-[28px] border border-border bg-card/95 p-5 shadow-sm backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Protocol Metadata</p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">协议与扩展字段</h2>
              <p className="mt-2 text-sm text-muted-foreground">metadata 用于承载不同 RWA 协议的非统一字段，当前以 mock 数据展示未来真实协议字段形态。</p>

              <div className="mt-4 space-y-2">
                {Object.entries(detail.asset.metadata ?? {}).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-background px-3 py-3 text-sm">
                    <span className="font-medium text-foreground">{key}</span>
                    <span className="max-w-[65%] break-words text-right text-muted-foreground">{formatMetadata(value)}</span>
                  </div>
                ))}

                {Object.keys(detail.asset.metadata ?? {}).length === 0 ? (
                  <div className="rounded-2xl border border-border bg-background px-3 py-3 text-sm text-muted-foreground">
                    当前没有额外协议字段。
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[28px] border border-amber-500/25 bg-amber-500/10 p-5 shadow-sm backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Test Environment</p>
              <p className="mt-2 text-sm text-muted-foreground">
                本页中的风控、资金流、历史 APY 和交易结果均为测试环境 mock 数据，当前不触发真实 Uniswap swap 或协议存取款。
              </p>
            </section>
          </div>
        </section>
      </section>
    </main>
  )
}
