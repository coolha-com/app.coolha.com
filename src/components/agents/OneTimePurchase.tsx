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
 * ⚠️ 诚实纪律：当前是 test 模式，不产生真实扣款，也不授予任何权益。
 * 页面不宣称「购买后立即可用」，权益发放要等 Webhook + 订单核验落地。
 */

// 永久商品链接（不是 24 小时即失效的 checkout session）。
// 生产环境用 WAFFO_CHECKOUT_URL 覆盖为 KYB 审核通过后的正式链接。
const DEFAULT_CHECKOUT =
  "https://pancake.waffo.ai/store/coolha-c1wzb0nl/product/PROD_4yvNFDfR3pynj7PmAooWSG?type=onetime&currency=USD&test=true"

export function OneTimePurchase() {
  const checkoutUrl = process.env.WAFFO_CHECKOUT_URL ?? DEFAULT_CHECKOUT
  const isTest = checkoutUrl.includes("test=true")

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
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
            前往结账
            <RiArrowRightUpLine className="size-4" />
          </a>
        </Button>
      </div>

      {isTest ? (
        <div className="flex items-start gap-2 rounded-4xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <RiErrorWarningLine className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-xs leading-5">
            <p className="font-medium">当前为测试模式，不会产生真实扣款</p>
            <p className="mt-1 text-muted-foreground">
              正式收款需通过 KYB 审核并切换到生产链接。此页面暂不发放任何权益：
              订单核验 Webhook 与权益授予尚未接入，不做「买了就能用」的承诺。
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
