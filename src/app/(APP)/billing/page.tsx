import type { Metadata } from "next"
import Link from "next/link"
import { listRecentUsage, summarizeUsage } from "@/lib/neon/ai-usage"
import { getWalletSessionFromCookies } from "@/lib/neon/wallet-auth"
import { resolveSubject } from "@/lib/neon/identity"
import { listRwaRuns } from "@/lib/neon/rwa-research"
import { listSubscriptionOrders } from "@/lib/neon/subscription"

export const dynamic = "force-dynamic"

function formatStamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString()
}

export const metadata: Metadata = {
  title: "用量与订单",
  description: "当前账户自己的调用记录、研究订单和订阅订单。",
}

export default async function BillingPage() {
  const session = await getWalletSessionFromCookies()
  const subject = session?.address ? await resolveSubject(session.address).catch(() => null) : null
  const [summary, usage, runs, subscriptions] = subject
    ? await Promise.all([
        summarizeUsage(subject).catch(() => null),
        listRecentUsage(subject, 20).catch(() => []),
        listRwaRuns(subject, 20).catch(() => []),
        listSubscriptionOrders(subject, 10).catch(() => []),
      ])
    : [null, [], [], []]

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-normal">用量与订单</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        只显示当前账户。研究 API 的记录写在现有用量表里，token 数为 0，不代表已付款，也不增加赞助额度。
        订阅收款仍在 <Link href="/ai/billing" className="underline-offset-4 hover:underline">余额与账单</Link>。
        钱包在 <Link href="/wallet" className="underline-offset-4 hover:underline">钱包页</Link>，
        调用明细也可看 <Link href="/ai/usage" className="underline-offset-4 hover:underline">用量记录</Link>。
      </p>
      {!subject ? (
        <p className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          请先在侧边栏签名登录。
        </p>
      ) : null}
      {summary ? (
        <p className="mt-4 text-sm">
          调用 {summary.calls} 次 · token {summary.totalTokens} · 记录成本 {summary.totalCostUsd}
        </p>
      ) : null}
      <h2 className="mt-6 text-base font-medium">研究订单</h2>
      <ul className="mt-2 space-y-2 text-sm">
        {runs.length === 0 ? <li className="text-muted-foreground">还没有研究订单。</li> : null}
        {runs.map((run) => (
          <li key={run.orderId} className="rounded-xl border p-3">
            {run.target} · {run.status} · 未付款 · 标价未公布 · {run.createdAt}
          </li>
        ))}
      </ul>
      <h2 className="mt-6 text-base font-medium">订阅订单</h2>
      <ul className="mt-2 space-y-2 text-sm">
        {subscriptions.length === 0 ? <li className="text-muted-foreground">没有订阅订单。</li> : null}
        {subscriptions.map((order) => (
          <li key={order.id} className="rounded-xl border p-3">
            {order.plan} · {order.status} · {order.amountToken} {order.token}
          </li>
        ))}
      </ul>
      <h2 className="mt-6 text-base font-medium">调用记录</h2>
      <ul className="mt-2 space-y-2 text-sm">
        {usage.length === 0 ? <li className="text-muted-foreground">还没有调用记录。</li> : null}
        {usage.map((row) => (
          <li key={row.id} className="rounded-xl border p-3">
            {row.source} · {row.model_id} · {row.status} · {formatStamp(row.created_at)}
          </li>
        ))}
      </ul>
    </div>
  )
}
