import type { Metadata } from "next"
import { OneTimePurchase } from "@/components/agents/OneTimePurchase"
import {
  Notice,
  PageHeader,
  PageShell,
  SectionHeading,
  Surface,
} from "@/components/PageShell"
import { getCurrentUser } from "@/lib/neon/session"
import {
  listWaffoOrders,
  readWaffoPurchaseSummary,
  type WaffoOrderStatus,
} from "@/lib/neon/waffo"
import { isWaffoTestMode } from "@/lib/waffo/client"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "购买 Agent 服务",
  description: "一次性购买付费的 Agent 即服务，法币结账（Waffo Pancake 托管）。",
}

/**
 * 商业模式已改为一次性购买 Agent 服务。
 * 旧的链上订阅代码保留给历史订单与账本查询，但不再渲染订阅档位与下单 CTA。
 */

const STATUS_LABEL: Record<WaffoOrderStatus, string> = {
  pending: "待支付",
  paid: "已支付",
  refunded: "已退款",
  failed: "失败",
}

function formatStamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString()
}

export default async function PurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; order?: string }>
}) {
  const { paid, order } = await searchParams
  const user = await getCurrentUser()
  const subject = user?.subject ?? null

  const orders = subject ? await listWaffoOrders(subject, 20).catch(() => []) : []
  const summary = subject
    ? await readWaffoPurchaseSummary(subject).catch(() => ({
        paidCalls: 0,
        paidByCurrency: [],
      }))
    : { paidCalls: 0, paidByCurrency: [] }

  return (
    <PageShell>
      <PageHeader
        title="购买 Agent 服务"
        description="一次性购买专业 Agent 服务，按次结算；购买记录与账本在这里查看。"
      />

      {paid === "1" ? (
        <Notice className="mb-4">
          收银台已支付完成。订单以 Waffo 的签名回调为准入账，
          {order ? `订单号 ${order}，` : ""}
          若下方列表还没变成「已支付」，说明回调还在路上，稍后刷新即可。
        </Notice>
      ) : null}

      <OneTimePurchase testMode={isWaffoTestMode()} />

      {!subject ? (
        <Notice className="mt-4">请先在侧边栏登入，订单才能归属到你的账号。</Notice>
      ) : null}

      {summary.paidCalls > 0 ? (
        <Surface className="mt-4">
          已购买 {summary.paidCalls} 次
          {summary.paidByCurrency.length > 0
            ? ` · 累计 ${summary.paidByCurrency
                .map((item) => `${item.total} ${item.currency}`)
                .join(" + ")}`
            : ""}
        </Surface>
      ) : null}

      <SectionHeading>购买记录</SectionHeading>
      <ul className="space-y-2">
        {orders.length === 0 ? (
          <li className="px-1 text-sm text-muted-foreground">还没有购买记录。</li>
        ) : null}
        {orders.map((order) => (
          <Surface as="li" key={order.id}>
            {order.id} · {STATUS_LABEL[order.status] ?? order.status} ·{" "}
            {order.amount ? `${order.amount} ${order.currency}` : "待定"} ·{" "}
            {formatStamp(order.createdAt)}
          </Surface>
        ))}
      </ul>
    </PageShell>
  )
}
