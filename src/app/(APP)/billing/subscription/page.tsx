import type { Metadata } from "next"
import { OneTimePurchase } from "@/components/agents/OneTimePurchase"
import { PageHeader, PageShell } from "@/components/PageShell"

export const metadata: Metadata = {
  title: "购买 Agent 服务",
  description: "一次性购买付费的 Agent 即服务，法币结账（测试模式）。",
}

/**
 * 商业模式已改为一次性购买 Agent 服务。
 * 旧的链上订阅代码保留给历史订单与账本查询，但不再渲染订阅档位与下单 CTA。
 */
export default function PurchasePage() {
  return (
    <PageShell>
      <PageHeader
        title="购买 Agent 服务"
        description="一次性购买专业 Agent 服务，按次结算；购买记录与账本在这里查看。"
      />
      <OneTimePurchase />
    </PageShell>
  )
}
