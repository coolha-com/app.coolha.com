import { RiBankLine, RiLockLine } from "react-icons/ri"
import { Button } from "@/components/ui/button"
import { rwaAssets } from "@/lib/aifi-data"

export default function RwaMarketplacePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-normal">代币化市场</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          基于链上流动性的代币化真实资产交易入口。每个资产必须区分代币、底层资产、发行方、法律权利、托管、赎回、合格投资者要求与风险披露。
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
              <Row label="发行方" value={asset.issuer} />
              <Row label="司法辖区" value={asset.jurisdiction} />
              <Row label="底层资产" value={asset.underlying} />
              <Row label="净值" value={asset.nav} />
              <Row label="派息" value={asset.distribution} />
              <Row label="期限" value={asset.maturity} />
              <Row label="总价值" value={asset.totalValue} />
              <Row label="可流通量" value={asset.availableSupply} />
              <Row label="区块链" value={asset.blockchain} />
            </dl>

            <div className="mt-6 rounded-xl border bg-background p-3 text-sm">
              <div className="flex items-center gap-2 font-medium"><RiLockLine /> 合格投资者门槛</div>
              <p className="mt-2 text-muted-foreground">{asset.eligibility}</p>
              <p className="mt-2 text-xs text-muted-foreground">风险：{asset.risk}</p>
            </div>

            <Button className="mt-5 w-full" disabled>
              需要 KYC / 白名单
            </Button>
          </article>
        ))}
        {rwaAssets.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-5 text-sm leading-6 text-muted-foreground xl:col-span-3">
            暂无已接入的真实代币化资产。接入真实合约与链上流动性后将在此展示。
          </div>
        ) : null}
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
