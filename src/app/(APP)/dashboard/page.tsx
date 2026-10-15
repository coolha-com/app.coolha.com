import Link from "next/link"
import {
  RiArrowRightLine,
  RiBankCardLine,
  RiCpuLine,
  RiExchangeDollarLine,
  RiFireLine,
  RiRobot2Line,
  RiShieldCheckLine,
} from "react-icons/ri"
import { aiAssets, agentServices, settlementSteps, subscriptionProducts } from "@/lib/aifi-data"

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">


      <div className="grid gap-5 xl:grid-cols-2">
        <MarketSection
          title="算力市场"
          href="/ai"
          icon={<RiCpuLine className="size-5" />}
          items={aiAssets.map((item) => ({
            title: item.name,
            meta: `${item.category} · ${item.apiPrice}`,
            description: item.capability,
            stat: item.throughput,
          }))}
        />

        <MarketSection
          title="智能体市场"
          href="/agent"
          icon={<RiRobot2Line className="size-5" />}
          items={agentServices.map((item) => ({
            title: item.name,
            meta: `${item.category} · ${item.settlement}`,
            description: item.service,
            stat: item.trust,
          }))}
        />

        <MarketSection
          title="代币化市场"
          href="/rwa"
          icon={<RiExchangeDollarLine className="size-5" />}
          items={agentServices.map((item) => ({
            title: item.name,
            meta: `${item.category} · ${item.settlement}`,
            description: item.service,
            stat: item.trust,
          }))}
        />
      </div>
    </main>
  )
}

function MarketSection({
  title,
  href,
  icon,
  items,
}: {
  title: string
  href: string
  icon: React.ReactNode
  items: Array<{ title: string; meta: string; description: string; stat: string }>
}) {
  return (
    <section className="rounded-3xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/15 text-primary">{icon}</div>
          <h2 className="font-semibold">{title}</h2>
        </div>
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          查看 <RiArrowRightLine className="size-4" />
        </Link>
      </div>

      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-background p-4 text-sm leading-6 text-muted-foreground">
            暂无已接入的真实数据。接入真实供应、价格、库存或链上记录后，这里才会展示列表。
          </div>
        ) : items.map((item, index) => (
          <Link key={item.title} href={href} className="block rounded-2xl border bg-background p-4 transition hover:border-primary/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  {index === 0 ? <RiFireLine className="size-4 text-primary" /> : null}
                  <h3 className="font-medium">{item.title}</h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
              </div>
              <div className="max-w-32 text-right text-sm font-medium">{item.stat}</div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
