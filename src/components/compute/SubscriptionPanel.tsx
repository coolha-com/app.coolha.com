"use client"

import { useCallback, useEffect, useState } from "react"
import {
  RiCheckLine,
  RiFileCopyLine,
  RiLoader4Line,
  RiRefreshLine,
  RiShieldKeyholeLine,
  RiTimeLine,
  RiWallet3Line,
} from "react-icons/ri"
import { Button } from "@/components/ui/button"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import {
  PLANS,
  SPONSORED_DAILY_REQUESTS,
  SPONSORED_DAILY_TOKENS,
  formatTokens,
  isPlanId,
  type PlanId,
} from "@/lib/compute/plans"
import { PricingTable } from "@/components/compute/PricingTable"
import { ROADMAP } from "@/components/compute/pricing-matrix"
import {
  reloadSubscriptionStatus,
  useSubscriptionStatus,
  type OrderView,
} from "@/lib/compute/subscription-store"
import {
  SUBSCRIPTION_CHAIN_KEYS,
  SUBSCRIPTION_CHAINS,
  SUBSCRIPTION_TOKENS,
  type ChainKey,
  type TokenSymbol,
} from "@/lib/subscription/config"
import { cn } from "@/lib/utils"

/**
 * 订阅与账单。
 *
 * **定价表对所有人可见**（含未登录访客）——价格与权益是公开信息，
 * 藏起来只会让人误以为「要先注册才知道多少钱」。付费动作与账本流水才要求签名登录。
 *
 * 收款流程：选档位 → 选网络与币种 → 生成订单（含精确金额与收款地址）
 *     → 用户链上转账 → 「我已完成支付」或轮询自动入账 → 授予权益。
 *
 * 写死的核心事实：订阅解锁的是**软件能力**，模型推理费用由用户自己的 Key 承担，
 * Coolha 不代售算力。免费模型额度是赞助的获客成本，超限解法是接自己的模型，不是付费墙。
 */

const STATUS_TEXT: Record<string, string> = {
  pending: "等待链上到账",
  paid: "已到账",
  expired: "已过期",
  canceled: "已取消",
  refunded: "已退款",
}

export function SubscriptionPanel() {
  const { signedIn, isConnected, signIn } = useWalletAuth()
  const status = useSubscriptionStatus()
  const [chain, setChain] = useState<ChainKey>("base")
  const [token, setToken] = useState<TokenSymbol>("USDC")
  const [order, setOrder] = useState<OrderView | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentPlan: PlanId | null = signedIn
    ? isPlanId(status?.plan)
      ? status.plan
      : "free"
    : null

  const refreshOrder = useCallback(async (id: string) => {
    const response = await fetch(`/api/subscription/orders/${id}`, { credentials: "same-origin" })
    if (!response.ok) return
    const json = (await response.json()) as { order: OrderView }
    setOrder(json.order)
    if (json.order.status !== "pending") void reloadSubscriptionStatus()
  }, [])

  // 轮询：订单仍 pending 时每 8 秒查一次（服务端自带 60s 扫链节流兜底）
  useEffect(() => {
    if (!order || order.status !== "pending") return
    const timer = setInterval(() => void refreshOrder(order.id), 8000)
    return () => clearInterval(timer)
  }, [order, refreshOrder])

  const subscribe = async (plan: PlanId) => {
    setError(null)
    setBusy(true)
    try {
      const response = await fetch("/api/subscription/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ plan, chain, token }),
      })
      const json = (await response.json()) as {
        order?: OrderView
        error?: { message?: string }
      }
      if (!response.ok || !json.order) {
        throw new Error(json.error?.message ?? "创建订单失败")
      }
      setOrder(json.order)
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建订单失败")
    } finally {
      setBusy(false)
    }
  }

  const confirmPaid = async () => {
    if (!order) return
    setError(null)
    setBusy(true)
    try {
      const response = await fetch(`/api/subscription/orders/${order.id}/sync`, {
        method: "POST",
        credentials: "same-origin",
      })
      const json = (await response.json()) as { order?: OrderView; error?: { message?: string } }
      if (!response.ok || !json.order) throw new Error(json.error?.message ?? "确认失败")
      setOrder(json.order)
      if (json.order.status !== "pending") void reloadSubscriptionStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : "确认失败")
    } finally {
      setBusy(false)
    }
  }

  const copyAddress = async () => {
    if (!order) return
    try {
      await navigator.clipboard.writeText(order.payTo)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError("复制失败，请手动选择地址")
    }
  }

  const signInAndLoad = () => {
    if (!isConnected) return
    void signIn().then(() => reloadSubscriptionStatus())
  }

  return (
    <div className="space-y-4">
      {/* 1. 定价表：始终可见，未登录也能读全部价格与权益 */}
      <PricingTable
        currentPlan={currentPlan}
        busy={busy}
        onSelect={(plan) => void subscribe(plan)}
      />

      {/* 2. 登录引导：仅在需要管理订阅时才出现，不遮挡定价 */}
      {!signedIn ? (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <RiShieldKeyholeLine className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">订阅与账本需要签名登录</p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                钱包地址即身份，无需邮箱与密码。权益绑定到该身份，换设备也能恢复。
                登录只是为了让订单与权益有归属，看价格不需要登录。
              </p>
              <Button
                className="mt-3 rounded-xl"
                disabled={!isConnected}
                onClick={signInAndLoad}
              >
                {isConnected ? "签名登录" : "请先在侧边栏连接钱包"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {signedIn ? (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">当前档位</p>
              <p className="mt-1 text-2xl font-semibold">
                {PLANS[currentPlan ?? "free"].name}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  免费对话 {formatTokens(SPONSORED_DAILY_TOKENS)} tokens /{" "}
                  {SPONSORED_DAILY_REQUESTS} 次每天
                </span>
              </p>
            </div>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => void reloadSubscriptionStatus()}
            >
              <RiRefreshLine className="size-4" />
              刷新
            </Button>
          </div>
        </div>
      ) : null}

      {/* 3. 支付网络与币种：选链选币属于付费动作，登录后才展示 */}
      {signedIn && !order ? (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <p className="text-sm font-medium">支付网络与币种</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUBSCRIPTION_CHAIN_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setChain(key)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  chain === key
                    ? "border-primary bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {SUBSCRIPTION_CHAINS[key].label}
              </button>
            ))}
            <span className="mx-1 w-px self-stretch bg-border" />
            {SUBSCRIPTION_TOKENS.map((symbol) => (
              <button
                key={symbol}
                type="button"
                onClick={() => setToken(symbol)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  token === symbol
                    ? "border-primary bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {symbol}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            以 USD 计价，按稳定币 ≈ 1:1 折算。链上无法自动扣款，到期需手动续费。
          </p>
        </div>
      ) : null}

      {/* 4. 待支付订单 */}
      {order && order.status === "pending" ? (
        <div className="rounded-2xl border border-primary/40 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              订阅 {PLANS[isPlanId(order.plan) ? order.plan : "free"].name}
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              <RiLoader4Line className="size-3.5" />
              {STATUS_TEXT[order.status] ?? order.status}
            </span>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            请向下方地址转账 <span className="font-medium text-foreground">精确金额</span>
            （金额尾数用于自动匹配订单，请勿改动）
          </p>

          <div className="mt-3 rounded-xl bg-muted px-4 py-3">
            <p className="font-mono text-lg font-semibold tabular-nums">
              {order.amountToken} {order.token}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {SUBSCRIPTION_CHAINS[order.chain as ChainKey]?.label ?? order.chain}
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-muted px-3 py-2 font-mono text-xs">
              {order.payTo}
            </code>
            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              onClick={() => void copyAddress()}
              aria-label="复制收款地址"
            >
              {copied ? <RiCheckLine className="size-4" /> : <RiFileCopyLine className="size-4" />}
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="rounded-xl" disabled={busy} onClick={() => void confirmPaid()}>
              {busy ? "确认中…" : "我已完成支付"}
            </Button>
            <Button
              variant="ghost"
              className="rounded-xl"
              disabled={busy}
              onClick={() => setOrder(null)}
            >
              关闭
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            订单有效期 30 分钟；到账并达到确认数后自动开通，也可点上方按钮手动触发一次确认。
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {/* 5. 规划中 */}
      <div className="rounded-2xl border border-dashed bg-card/50 p-5">
        <p className="text-sm font-medium">规划中的能力（尚未上线，不作为当前卖点）</p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {ROADMAP.map((item) => (
            <li key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RiTimeLine className="size-3.5 shrink-0 text-muted-foreground/70" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* 6. 账本流水：登录后可见 */}
      {signedIn ? (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <RiWallet3Line className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">订阅流水</p>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  时间
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  档位
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  网络 / 币种
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  金额
                </th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  状态
                </th>
              </tr>
            </thead>
            <tbody>
              {(status?.orders ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    暂无订阅记录。
                  </td>
                </tr>
              ) : (
                (status?.orders ?? []).map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {new Date(item.expiresAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs">{item.plan}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {item.chain} / {item.token}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs tabular-nums">
                      {item.amountToken} {item.token}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {STATUS_TEXT[item.status] ?? item.status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}