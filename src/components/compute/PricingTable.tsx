"use client"

import { RiCheckLine } from "react-icons/ri"
import { Button } from "@/components/ui/button"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import {
  PLANS,
  PLAN_ORDER,
  SPONSORED_DAILY_REQUESTS,
  SPONSORED_DAILY_TOKENS,
  formatTokens,
  type PlanId,
} from "@/lib/compute/plans"
import { MATRIX_ROWS, PENDING_ROWS, PENDING_TEXT, matrixCell } from "@/components/compute/pricing-matrix"
import { cn } from "@/lib/utils"

/**
 * 定价表（**始终对所有人可见**，无需登录）。
 *
 * 未登录用户可以完整阅读价格、权益矩阵与「赞助额度全档位统一」的说明；
 * 只有触发付费动作（订阅 / 选网络币种 / 管理订单）才要求钱包签名登录。
 * 这是转化漏斗的前提——把价格藏起来只会让人以为要注册才知道多少钱。
 *
 * ⚠️ 付费只卖软件能力，矩阵中「免费模型对话」一行四档相同，勿改。
 */

const SPONSORED_LABEL = `每日 ${formatTokens(SPONSORED_DAILY_TOKENS)} tokens / ${SPONSORED_DAILY_REQUESTS} 次`

function daysLabel(value: number | null): string {
  return value === null ? "永久" : `${value} 天`
}

export function PricingTable({
  currentPlan,
  busy,
  onSelect,
}: {
  /** 已登录时的当前档位；未登录传 null（不出现「当前档位」标记） */
  currentPlan: PlanId | null
  busy: boolean
  onSelect: (plan: PlanId) => void
}) {
  const { signedIn, isConnected, signIn } = useWalletAuth()

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId]
          const active = signedIn && planId === currentPlan
          const free = plan.priceUsd <= 0
          return (
            <div
              key={planId}
              className={cn(
                "flex flex-col rounded-2xl border bg-card p-5 shadow-sm",
                active && "border-primary",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold">{plan.name}</p>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {free ? "$0" : `$${plan.priceUsd}`}
                  {free ? null : <span className="text-xs">/月</span>}
                </p>
              </div>
              <p className="mt-1 min-h-8 text-xs leading-5 text-muted-foreground">{plan.tagline}</p>
              {/* 只列已落地的能力（与下方矩阵中非「规划中」的行一致），不拿纸面配置当卖点 */}
              <ul className="mt-2 flex-1 space-y-1.5">
                {[
                  SPONSORED_LABEL,
                  "本机会话历史",
                  ...(plan.limits.historyDays !== 0
                    ? [`云端历史保留 ${daysLabel(plan.limits.historyDays)}`]
                    : []),
                  ...(plan.limits.crossDeviceSync ? ["跨设备同步"] : []),
                  ...(plan.limits.fullTextSearch ? ["历史全文检索"] : []),
                ].map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-xs leading-5">
                    <RiCheckLine className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              {free ? (
                <Button className="mt-4 w-full rounded-xl" variant="outline" disabled>
                  免费
                </Button>
              ) : signedIn ? (
                <Button
                  className="mt-4 w-full rounded-xl"
                  variant={active ? "outline" : "default"}
                  disabled={active || busy}
                  onClick={() => onSelect(planId)}
                >
                  {active ? "当前档位" : "用稳定币订阅"}
                </Button>
              ) : (
                <Button
                  className="mt-4 w-full rounded-xl"
                  variant="outline"
                  onClick={() => {
                    if (isConnected) void signIn()
                  }}
                >
                  {isConnected ? "签名登录以订阅" : "请先连接钱包"}
                </Button>
              )}
            </div>
          )
        })}
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">
                权益
              </th>
              {PLAN_ORDER.map((planId) => (
                <th
                  key={planId}
                  scope="col"
                  className="px-4 py-2.5 text-center font-medium"
                >
                  {PLANS[planId].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX_ROWS.map((row, index) => (
              <tr key={row.id} className={cn(index > 0 && "border-t")}>
                <th
                  scope="row"
                  className="px-4 py-2.5 text-xs font-normal text-muted-foreground"
                >
                  {row.label}
                  {row.uniform ? (
                    <span className="ml-1.5 text-[10px] text-muted-foreground/70">
                      全档位统一
                    </span>
                  ) : null}
                </th>
                {PLAN_ORDER.map((planId) => (
                  <td
                    key={planId}
                    className={cn(
                      "px-4 py-2.5 text-center text-xs tabular-nums",
                      PENDING_ROWS.has(row.id) && "text-muted-foreground/60",
                    )}
                  >
                    {PENDING_ROWS.has(row.id)
                      ? PENDING_TEXT
                      : matrixCell(PLANS[planId].limits, row.id, SPONSORED_LABEL)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-6 text-muted-foreground">
        订阅解锁的是 Coolha 的软件能力与服务（历史保留、跨设备同步、全文检索、导出、编排、出口），
        <span className="text-foreground">模型推理费用始终由你自己的 API Key 承担</span>
        ，Coolha 不代售模型算力。赞助额度是获客成本，超限的正确解法是接入自己的模型，而不是升级。
        标注「规划中」的档位尚未上线，不作为当前承诺。
      </p>
    </div>
  )
}