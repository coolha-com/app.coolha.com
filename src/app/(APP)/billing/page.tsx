import type { Metadata } from "next"
import { RiBankCardLine, RiBarChartBoxLine } from "react-icons/ri"
import { listRecentUsage, summarizeUsage } from "@/lib/neon/ai-usage"
import { getWalletSessionFromCookies } from "@/lib/neon/wallet-auth"
import { resolveSubject } from "@/lib/neon/identity"
import { listRwaRuns } from "@/lib/neon/rwa-research"
import { listSubscriptionOrders } from "@/lib/neon/subscription"
import {
  EntryCard,
  InlineLink,
  Notice,
  PageHeader,
  PageShell,
  SectionHeading,
  Surface,
} from "@/components/PageShell"

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
    <PageShell>
      <PageHeader
        title="用量与订单"
        description={
          <>
            只显示当前账户。研究 API 的记录写在现有用量表里，token 数为 0，不代表已付款，也不增加赞助额度。
            订阅收款仍在 <InlineLink href="/billing/subscription">余额与账单</InlineLink>。
            钱包在 <InlineLink href="/wallet">钱包页</InlineLink>，
            调用明细也可看 <InlineLink href="/billing/usage">用量记录</InlineLink>。
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <EntryCard
          title="余额与账单"
          description="订阅档位、链上收款订单与当前账本。"
          href="/billing/subscription"
          hrefLabel="打开余额与账单"
          icon={RiBankCardLine}
        />
        <EntryCard
          title="用量记录"
          description="当前账户的调用明细与 token 用量。"
          href="/billing/usage"
          hrefLabel="打开用量记录"
          icon={RiBarChartBoxLine}
        />
      </div>

      {!subject ? <Notice className="mt-4">请先在侧边栏签名登录。</Notice> : null}

      {summary ? (
        <Surface className="mt-4">
          调用 {summary.calls} 次 · token {summary.totalTokens} · 记录成本 {summary.totalCostUsd}
        </Surface>
      ) : null}

      <SectionHeading>研究订单</SectionHeading>
      <ul className="space-y-2">
        {runs.length === 0 ? (
          <li className="px-1 text-sm text-muted-foreground">还没有研究订单。</li>
        ) : null}
        {runs.map((run) => (
          <Surface as="li" key={run.orderId}>
            {run.target} · {run.status} · 未付款 · 标价未公布 · {run.createdAt}
          </Surface>
        ))}
      </ul>

      <SectionHeading>订阅订单</SectionHeading>
      <ul className="space-y-2">
        {subscriptions.length === 0 ? (
          <li className="px-1 text-sm text-muted-foreground">没有订阅订单。</li>
        ) : null}
        {subscriptions.map((order) => (
          <Surface as="li" key={order.id}>
            {order.plan} · {order.status} · {order.amountToken} {order.token}
          </Surface>
        ))}
      </ul>

      <SectionHeading>调用记录</SectionHeading>
      <ul className="space-y-2">
        {usage.length === 0 ? (
          <li className="px-1 text-sm text-muted-foreground">还没有调用记录。</li>
        ) : null}
        {usage.map((row) => (
          <Surface as="li" key={row.id}>
            {row.source} · {row.model_id} · {row.status} · {formatStamp(row.created_at)}
          </Surface>
        ))}
      </ul>
    </PageShell>
  )
}
