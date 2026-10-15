import type { Metadata } from "next"
import { ModulePage } from "@/components/compute/ModulePage"
import { SubscriptionPanel } from "@/components/compute/SubscriptionPanel"

export const metadata: Metadata = {
  title: "订阅与账单",
  description: "链上订阅（USDC / USDT）与账本流水",
}

export const dynamic = "force-dynamic"

/**
 * 订阅与账单。
 * 链上收款采用「订单匹配法」：下单 → 转精确金额 → 自动匹配入账 → 授予权益。
 * 详见 docs/PRICING_AND_ENTITLEMENTS.md 第五节。
 */
export default function BillingPage() {
  return (
    <ModulePage
      title="订阅与账单"
      description="四档订阅：Free $0 / Plus $6 / Pro $10 / Ultra $30（USD/月），仅支持链上稳定币结算（USDC / USDT，Base 与 Ethereum）。订阅解锁的是软件能力，模型推理费用由你自己的 API Key 承担。"
    >
      <SubscriptionPanel />
    </ModulePage>
  )
}
