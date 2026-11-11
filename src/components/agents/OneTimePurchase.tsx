"use client"

import { useState } from "react"
import { RiArrowRightUpLine, RiErrorWarningLine, RiShoppingBagLine } from "react-icons/ri"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/**
 * 一次性购买 Agent 服务。
 *
 * 商业模式已改：改为单次购买付费的 Agent 即服务。
 * 法币收款由 Waffo Pancake（Merchant of Record）承载；x402 / 稳定币收款
 * 留给后续阶段，让外部 Agent 也能自主采购。
 *
 * 付款走服务端 SDK 开的收银台会话（/api/waffo/checkout），而不是硬编码商品链接：
 * 只有走会话，回调里才有我们的单号，订单才能对回账号。
 *
 * ⚠️ 诚实纪律：test 模式下不产生真实扣款。
 * 权益发放要等 Webhook 订单核销 + 扣减闸门落地，不做「买了就能用」的承诺。
 */

interface OneTimePurchaseProps {
  /** 服务端判定：当前是不是测试模式 */
  testMode?: boolean
  /** 支付完成后回到的站内路径（如 "/"） */
  returnTo?: string
}

export function OneTimePurchase({ testMode = true, returnTo }: OneTimePurchaseProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startCheckout() {
    if (loading) return
    setLoading(true)
    setError(null)

    // 先同步开一个空窗口：await 之后再 window.open 会被浏览器拦截
    const popup = window.open("", "_blank")

    try {
      const response = await fetch("/api/waffo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(returnTo ? { returnTo } : {}),
      })
      const payload = (await response.json().catch(() => null)) as
        | { checkoutUrl?: string; error?: { code?: string; message?: string } }
        | null

      if (!response.ok || !payload?.checkoutUrl) {
        const code = payload?.error?.code
        const message =
          code === "AUTH_REQUIRED"
            ? "请先登入再购买。"
            : (payload?.error?.message ?? "创建收银台失败，请稍后重试。")
        setError(message)
        popup?.close()
        return
      }

      if (popup) {
        popup.location.href = payload.checkoutUrl
      } else {
        window.location.href = payload.checkoutUrl
      }
    } catch {
      setError("网络异常，请稍后重试。")
      popup?.close()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-4 rounded-4xl bg-card p-5 shadow-sm ring-1 ring-foreground/5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <RiShoppingBagLine className="size-4 text-muted-foreground" />
            <h2 className="text-base font-medium">智能体服务 · 按次调用付费</h2>
            <Badge variant="secondary">一次性购买</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            $19.00 USD / 次。购买的是 Agent 执行与交付服务，不是算力或 token 额度；按次结算，无需订阅。
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            法币收款由 Waffo Pancake 作为 Merchant of Record 处理（银行卡 / Apple Pay / Google Pay）。
            x402 与稳定币收款方案留待后续，让外部 Agent 也能自主采购。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={startCheckout}
          disabled={loading}
        >
          {loading ? "正在打开收银台…" : "前往结账"}
          <RiArrowRightUpLine className="size-4" />
        </Button>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-4xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
          <RiErrorWarningLine className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="text-xs leading-5">{error}</p>
        </div>
      ) : null}

      {testMode ? (
        <div className="flex items-start gap-2 rounded-4xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <RiErrorWarningLine className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-xs leading-5">
            <p className="font-medium">当前为测试模式，不会产生真实扣款</p>
            <p className="mt-1 text-muted-foreground">
              正式收款需通过 KYB 审核并切换到生产凭据。测试模式下订单与授权
              一样会写进账本（本地走 dev 分支），只是不产生真实扣款。
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
