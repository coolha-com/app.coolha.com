import type { Metadata } from "next"
import { RiBankCardLine, RiBarChartBoxLine } from "react-icons/ri"
import { listRecentUsage, summarizeUsage } from "@/lib/neon/ai-usage"
import { getCurrentUser } from "@/lib/neon/session"
import { listChatSessions } from "@/lib/neon/chat-sessions"
import { readGrantState, summarizeUsage as summarizeAgentUsage } from "@/lib/neon/agent-billing"
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
  description: "当前账户自己的调用记录、研究订单和历史订单。",
}

export default async function BillingPage() {
  const user = await getCurrentUser()
  const subject = user?.subject ?? null
  const [summary, usage, runs, subscriptions] = subject
    ? await Promise.all([
        summarizeUsage(subject).catch(() => null),
        listRecentUsage(subject, 20).catch(() => []),
        listChatSessions(subject, 20).catch(() => []),
        listSubscriptionOrders(subject, 10).catch(() => []),
      ])
    : [null, [], [], []]

  const grantState = subject ? await readGrantState(subject).catch(() => null) : null
  const agentUsage = subject ? await summarizeAgentUsage(subject).catch(() => null) : null

  return (
    <PageShell>
      <PageHeader
        title="用量与订单"
        description={
          <>
            只显示当前账户。按次购买的 Agent 服务授权与实际推理用量都记在这里。
            购买入口在 <InlineLink href="/billing/subscription">购买 Agent 服务</InlineLink>。
            资料与登录方式在 <InlineLink href="/settings/account">账户页</InlineLink>，
            调用明细也可看 <InlineLink href="/billing/usage">用量记录</InlineLink>。
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <EntryCard
          title="购买 Agent 服务"
          description="一次性购买、法币结账与账本流水。"
          href="/billing/subscription"
          hrefLabel="打开购买页"
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

      {!subject ? <Notice className="mt-4">请先在侧边栏登入。</Notice> : null}

      {summary ? (
        <Surface className="mt-4">
          调用 {summary.calls} 次 · token {summary.totalTokens} · 记录成本 {summary.totalCostUsd}
        </Surface>
      ) : null}

      <SectionHeading>服务授权</SectionHeading>
      {grantState && grantState.grant ? (
        <Surface className="text-sm">
          剩余额度 ${grantState.remainingUsd.toFixed(4)} / ${grantState.grant.tokenBudgetUsd.toFixed(0)}
          {" · "}
          {grantState.validDaysLeft !== null ? `${grantState.validDaysLeft} 天后到期` : "已到期"}
          {" · "}
          累计已用 ${grantState.grant.tokenUsedUsd.toFixed(4)}
        </Surface>
      ) : (
        <Surface className="text-sm text-muted-foreground">
          当前没有可用的服务授权。到
          <InlineLink href="/billing/subscription">购买 Agent 服务</InlineLink>
          购买后即可开始任务。
        </Surface>
      )}

      {agentUsage ? (
        <Surface className="mt-3 text-sm text-muted-foreground">
          实际推理用量：{agentUsage.requests} 次请求 · 输入 {agentUsage.inputTokens} token · 输出{" "}
          {agentUsage.outputTokens} token
          {agentUsage.costUsd !== null ? ` · 成本 $${agentUsage.costUsd.toFixed(6)}` : " · 成本未计入"}
        </Surface>
      ) : null}

      <SectionHeading>任务记录</SectionHeading>
      <ul className="space-y-2">
        {runs.length === 0 ? (
          <li className="px-1 text-sm text-muted-foreground">还没有任务记录。</li>
        ) : null}
        {runs.map((session) => (
          <Surface as="li" key={session.id}>
            {session.title || "未命名任务"}
            {session.preview ? ` · ${session.preview}` : ""} · {session.updatedAt}
          </Surface>
        ))}
      </ul>

      <SectionHeading>历史订单</SectionHeading>
      <ul className="space-y-2">
        {subscriptions.length === 0 ? (
          <li className="px-1 text-sm text-muted-foreground">没有历史订单。</li>
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
