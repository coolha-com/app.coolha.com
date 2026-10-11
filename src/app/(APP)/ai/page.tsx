import Link from "next/link"
import { RiBrainLine, RiKey2Line } from "react-icons/ri"
import { Button } from "@/components/ui/button"
import { aiAssets, subscriptionProducts } from "@/lib/aifi-data"

export default function AiMarketplacePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">算力市场</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            通过稳定币结算的 AI Token 中转与订阅服务。接入真实供应与价格后，这里将展示可购买的算力产品。
          </p>
        </div>

      </div>

      <section className="mb-6 grid gap-3 lg:grid-cols-3">
        {subscriptionProducts.map((product) => (
          <article key={product.name} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <RiBrainLine className="size-5" />
              </div>
              <span className="text-sm font-semibold">{product.price}</span>
            </div>
            <h2 className="mt-4 font-semibold">{product.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{product.type} · {product.cadence}</p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{product.includes}</p>
            <div className="mt-4 rounded-xl bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
              {product.chain}
            </div>
          </article>
        ))}
        {subscriptionProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-5 text-sm leading-6 text-muted-foreground lg:col-span-3">
            暂无已接入的真实订阅商品。接入真实供应与价格后将在此展示。
          </div>
        ) : null}
      </section>

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
              <Metric label="提供商" value={asset.provider} />
              <Metric label="上下文" value={asset.context} />
              <Metric label="API 价格" value={asset.apiPrice} />
              <Metric label="计费" value={asset.billing} />
              <Metric label="可用性" value={asset.availability} />
              <Metric label="延迟" value={asset.latency} />
              <Metric label="吞吐量" value={asset.throughput} />
              <Metric label="访问" value={asset.access} />
            </dl>

            <div className="mt-5 flex items-center gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              <RiKey2Line className="size-5 shrink-0 text-primary" />
              钱包签名与稳定币支付确认后激活访问权限。
            </div>
          </article>
        ))}
        {aiAssets.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-5 text-sm leading-6 text-muted-foreground lg:col-span-3">
            暂无已接入的真实算力资产。接入真实 API 与计量数据后将在此展示。
          </div>
        ) : null}
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
