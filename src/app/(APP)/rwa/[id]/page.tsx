import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ApyHistoryChart } from '@/components/rwa/ApyHistoryChart'
import { AssetHeader } from '@/components/rwa/AssetHeader'
import { FundFlow } from '@/components/rwa/FundFlow'
import { RiskPanel } from '@/components/rwa/RiskPanel'
import { TradePanel } from '@/components/rwa/TradePanel'
import { RWA_ASSETS, getRwaDetailById } from '@/lib/rwa/mockData'

type RwaDetailPageProps = {
  params: Promise<{ id: string }>
}

export function generateStaticParams() {
  return RWA_ASSETS.map((asset) => ({ id: asset.id }))
}

export async function generateMetadata({ params }: RwaDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const detail = getRwaDetailById(id)
  return {
    title: detail ? detail.asset.name : 'RWA Asset',
    description: detail?.asset.description ?? 'RWA asset detail page.',
  }
}

export default async function RwaDetailPage({ params }: RwaDetailPageProps) {
  const { id } = await params
  const detail = getRwaDetailById(id)

  if (!detail) notFound()

  return (
    <main className="min-h-[calc(100dvh-120px)] w-full bg-background px-4 py-5 md:px-6 md:py-7">
      <section className="mx-auto w-full max-w-7xl space-y-5">
        <AssetHeader asset={detail.asset} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 space-y-5">
            <RiskPanel asset={detail.asset} />
            <FundFlow detail={detail} />
            <ApyHistoryChart points={detail.apyHistory} />
          </section>

          <aside className="min-w-0">
            <TradePanel asset={detail.asset} />
          </aside>
        </div>
      </section>
    </main>
  )
}
