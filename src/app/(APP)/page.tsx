import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Agent 服务",
  description: "Coolha 的服务入口。当前可配置并下单的只有 RWA Research。",
}

/**
 * 过渡期服务入口。
 * 不是完整的 Agent 市场。Chat 仍在侧边栏，用来测试和调试。
 */
export default function ServiceEntryPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-normal">Agent 服务</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        这里是管理工作台，不是模型或工具市场。当前只挂一项可配置的只读研究服务。
      </p>
      <ul className="mt-6 space-y-3">
        <li className="rounded-2xl border bg-card p-4">
          <h2 className="text-base font-medium">RWA Research</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            保存 Agent Profile，提交只读研究任务，查看带来源和时间的报告。订单付款状态为未付款。
          </p>
          <Link href="/agents" className="mt-3 inline-flex text-sm font-medium underline-offset-4 hover:underline">
            在 Agents 目录中打开
          </Link>
        </li>
        <li className="rounded-2xl border bg-card p-4">
          <h2 className="text-base font-medium">任务</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            查看已经生成的订单和执行结果。
          </p>
          <Link href="/tasks" className="mt-3 inline-flex text-sm font-medium underline-offset-4 hover:underline">
            打开任务
          </Link>
        </li>
      </ul>
      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Chat 仍保留，用于测试和调试，不是这项服务的下单入口。
        <Link href="/chat" className="ml-1 underline-offset-4 hover:underline">打开 Chat</Link>
      </p>
      <section className="mt-8">
        <h2 className="text-sm font-medium">接入与账户</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li><Link href="/connect" className="underline-offset-4 hover:underline">接入说明</Link></li>
          <li><Link href="/developers" className="underline-offset-4 hover:underline">API 与 MCP</Link></li>
          <li><Link href="/console" className="underline-offset-4 hover:underline">调用控制台</Link></li>
          <li><Link href="/billing" className="underline-offset-4 hover:underline">用量与订单</Link></li>
        </ul>
      </section>
    </div>
  )
}
