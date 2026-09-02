import { RiBankLine, RiLockLine } from "react-icons/ri"
import { Button } from "@/components/ui/button"
import { rwaAssets } from "@/lib/aifi-data"

export default function RwaMarketplacePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-normal">RWA Marketplace</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          Buy tokenized real-world assets. Each listing must separate the token, underlying asset, issuer, legal rights, custody, redemption, eligibility, and risk disclosures.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {rwaAssets.map((asset) => (
          <article key={asset.symbol} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <RiBankLine className="size-6" />
              </div>
              <div>
                <h2 className="font-semibold">{asset.name}</h2>
                <p className="text-sm text-muted-foreground">{asset.symbol} · {asset.type}</p>
              </div>
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              <Row label="Issuer" value={asset.issuer} />
              <Row label="Jurisdiction" value={asset.jurisdiction} />
              <Row label="Underlying" value={asset.underlying} />
              <Row label="NAV" value={asset.nav} />
              <Row label="Distribution" value={asset.distribution} />
              <Row label="Maturity" value={asset.maturity} />
              <Row label="Total Value" value={asset.totalValue} />
              <Row label="Available Supply" value={asset.availableSupply} />
              <Row label="Blockchain" value={asset.blockchain} />
            </dl>

            <div className="mt-6 rounded-xl border bg-background p-3 text-sm">
              <div className="flex items-center gap-2 font-medium"><RiLockLine /> Eligibility Gate</div>
              <p className="mt-2 text-muted-foreground">{asset.eligibility}</p>
              <p className="mt-2 text-xs text-muted-foreground">Risk: {asset.risk}</p>
            </div>

            <Button className="mt-5 w-full" disabled>
              KYC / whitelist required
            </Button>
          </article>
        ))}
      </div>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right font-medium">{value}</dd>
    </div>
  )
}

