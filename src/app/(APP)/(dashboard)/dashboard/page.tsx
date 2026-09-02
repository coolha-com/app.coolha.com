import Link from "next/link"
import {
  RiArrowRightLine,
  RiCpuLine,
  RiExchangeDollarLine,
  RiFireLine,
  RiPuzzleLine,
  RiRobot2Line,
} from "react-icons/ri"
import { aiAssets, agentServices, rwaAssets } from "@/lib/aifi-data"

const hotExtensions = [
  {
    name: "Wallet Analyzer",
    category: "Web3",
    description: "Analyze wallet activity, DeFi exposure, and token flows.",
    installs: "12.3K installs",
  },
  {
    name: "GitHub Connector",
    category: "Developer",
    description: "Connect repositories for code review and project automation.",
    installs: "Connected service",
  },
  {
    name: "Supabase Connector",
    category: "Database",
    description: "Query product data and build backend workflows from your database.",
    installs: "Database extension",
  },
]

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Browse recommended AI API tokens, popular service agents, extension integrations, and active tokenized RWA assets from one application home.
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <MarketSection
          title="Recommended AI API Tokens"
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
          title="Popular Agents"
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
          title="Popular Extensions"
          href="/discover"
          icon={<RiPuzzleLine className="size-5" />}
          items={hotExtensions.map((item) => ({
            title: item.name,
            meta: item.category,
            description: item.description,
            stat: item.installs,
          }))}
        />

        <MarketSection
          title="Hot RWA Tokens"
          href="/rwa"
          icon={<RiExchangeDollarLine className="size-5" />}
          items={rwaAssets.map((item) => ({
            title: item.name,
            meta: `${item.symbol} · ${item.type}`,
            description: item.underlying,
            stat: item.nav,
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
          View <RiArrowRightLine className="size-4" />
        </Link>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
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
