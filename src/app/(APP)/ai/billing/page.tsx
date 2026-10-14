import type { Metadata } from "next"
import { RiBankCardLine } from "react-icons/ri"
import { MockBadge, MockNotice } from "@/components/compute/MockBadge"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "余额与账单",
  description: "余额、账本流水与充值订单",
}

const LAYERS = [
  {
    title: "充值订单",
    description: "用户创建订单，系统记录支付网络、币种、金额、目标地址与订单状态。",
    phase: "Phase 4",
  },
  {
    title: "支付确认",
    description: "服务端验证交易、收款地址、金额、链、代币合约与确认状态，防止重复入账。",
    phase: "Phase 4",
  },
  {
    title: "用量账本",
    description: "按实际调用费用记账；充值、扣费、退款、调整均为不可重复入账的流水。",
    phase: "Phase 3",
  },
]

export default function BillingPage() {
  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">余额与账单</h2>
        <p className="text-sm text-muted-foreground">
          余额、账本流水与充值订单。真实计费与充值机制验证通过前，不提供真实扣款。
        </p>
      </div>

      <MockNotice className="mt-1">
        本页全部内容为示例数据：余额、流水与订单均为占位展示，账本与充值尚未开放。
      </MockNotice>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">当前余额</p>
            <MockBadge />
          </div>
          <p className="mt-2 text-3xl font-semibold tabular-nums">$0.00</p>
          <p className="mt-1 text-xs text-muted-foreground">Mock 账本 · 不提供真实充值</p>
          <div className="mt-4">
            <Button disabled className="w-full rounded-xl">
              充值（Phase 4 开放）
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <RiBankCardLine className="size-4" />
            </div>
            <h3 className="font-semibold">三层账务设计</h3>
          </div>
          <div className="mt-4 space-y-3">
            {LAYERS.map((layer) => (
              <div key={layer.title} className="flex items-start justify-between gap-3 rounded-xl bg-muted px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{layer.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{layer.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-background px-2.5 py-0.5 text-xs text-muted-foreground">
                  {layer.phase}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">时间</th>
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">说明</th>
              <th className="px-4 py-3 text-right font-medium">金额</th>
              <th className="px-4 py-3 font-medium">关联</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                暂无账本流水。Phase 3 账本与 Phase 4 稳定币充值上线后，流水将在此展示。
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        说明：链上支付状态与站内用量账本分开管理；金额使用精确数值类型，账务处理支持幂等与审计。
      </p>
    </section>
  )
}
