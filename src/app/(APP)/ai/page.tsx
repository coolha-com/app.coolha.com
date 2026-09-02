import Link from "next/link"
import { RiBrainLine } from "react-icons/ri"
import { Button } from "@/components/ui/button"
import { aiAssets } from "@/lib/aifi-data"

export default function AiMarketplacePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">AI Model API Marketplace</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Buy access to AI model compute through API usage. Models are listed by provider, capability, context, price, latency, and wallet-based API access.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/wallet">Connect wallet for API access</Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {aiAssets.map((asset) => (
          <article key={asset.symbol} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <RiBrainLine className="size-6" />
                </div>
                <div>
                  <h2 className="font-semibold">{asset.name}</h2>
                  <p className="text-sm text-muted-foreground">{asset.category} · {asset.version}</p>
                </div>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs">API</span>
            </div>

            <p className="mt-5 text-sm leading-6 text-muted-foreground">{asset.capability}</p>

            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <Metric label="Provider" value={asset.provider} />
              <Metric label="Context" value={asset.context} />
              <Metric label="API Price" value={asset.apiPrice} />
              <Metric label="Billing" value={asset.billing} />
              <Metric label="Availability" value={asset.availability} />
              <Metric label="Latency" value={asset.latency} />
              <Metric label="Throughput" value={asset.throughput} />
              <Metric label="Access" value={asset.access} />
            </dl>

            <Button className="mt-5 w-full" variant="outline" disabled>
              API checkout requires usage metering
            </Button>
          </article>
        ))}
      </div>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  )
}
