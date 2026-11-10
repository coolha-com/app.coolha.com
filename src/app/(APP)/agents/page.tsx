import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Agents",
  description: "已交付的 Agent 服务目录。未上线的服务不能进入。",
}

const UNRELEASED = ["Contract Audit", "DeFi Analytics"]

export default function AgentsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-normal">Agents</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        目录里只有已经交付的服务可以进入。未上线的名称只作占位，不能下单，也没有配置页。
      </p>
      <ul className="mt-6 space-y-3">
        <li className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-medium">RWA Research</h2>
            <span className="text-xs text-muted-foreground">可进入</span>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            只读研究。保存 Profile 后提交任务，查看带来源和时间的报告。订单付款状态为未付款。
          </p>
          <Link href="/ai/agents/rwa-research" className="mt-3 inline-flex text-sm font-medium underline-offset-4 hover:underline">
            打开 RWA Research
          </Link>
        </li>
        {UNRELEASED.map((name) => (
          <li key={name} className="rounded-2xl border border-dashed bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-medium text-muted-foreground">{name}</h2>
              <span className="text-xs text-muted-foreground">未上线</span>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">尚未交付，不能进入，也不能下单。</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
