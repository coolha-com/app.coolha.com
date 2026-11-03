"use client"

import { useState } from "react"
import {
  RiAlertLine,
  RiCheckboxCircleLine,
  RiLoader4Line,
  RiSearchLine,
} from "react-icons/ri"
import { cn } from "@/lib/utils"

interface LiveToolResponse {
  status: "live" | "not_configured" | "not_integrated" | "upstream_error" | "invalid_request" | "rate_limited"
  message?: string
  chain?: { key: string; id: number; label: string }
  address?: string | null
  data?: {
    blockNumber: number
    blockTime: string | null
    balanceEth: number | null
    balanceWei: string | null
    txCount: number | null
  }
  source?: { provider: string; method: string }
  unknown?: string[]
  fetchedAt?: string
  latencyMs?: number
}

const CHAINS = [
  { key: "ethereum", label: "Ethereum" },
  { key: "base", label: "Base" },
]

/**
 * 工具实测台（当前用于 Alchemy 读链）。
 *
 * 为什么是客户端组件：目录页本身保持 `force-static`（30 个未接入工具仍是纯静态条目），
 * 真实链上查询只在用户点击时通过我们自己的服务端路由发起 ——
 * Alchemy 密钥只在服务端读取，永远不到浏览器。
 *
 * 诚实纪律：拿不到就如实显示「未配置 / 上游不可用」，不显示任何占位数值。
 */
export function ToolLiveRunner({ toolId }: { toolId: string }) {
  const [chain, setChain] = useState("ethereum")
  const [address, setAddress] = useState("")
  const [result, setResult] = useState<LiveToolResponse | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ chain })
      const trimmed = address.trim()
      if (trimmed) params.set("address", trimmed)
      const res = await fetch(`/api/ai/tools/${toolId}?${params.toString()}`, { cache: "no-store" })
      const json = (await res.json()) as LiveToolResponse
      setResult(json)
    } catch {
      setResult({ status: "upstream_error", message: "请求失败，请稍后重试" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <p className="text-xs font-medium text-primary">实测台 · 服务端 Alchemy 读链</p>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <div className="flex shrink-0 gap-1 rounded-lg border bg-background p-1">
          {CHAINS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setChain(c.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                chain === c.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x 地址（留空则只查区块高度）"
          aria-label="查询地址"
          className="h-8 min-w-0 flex-1 rounded-lg border bg-background px-2.5 text-xs outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className={cn(
            "inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg px-3 text-xs font-medium transition-colors",
            loading ? "cursor-not-allowed bg-muted text-muted-foreground" : "bg-primary text-black hover:opacity-90",
          )}
        >
          {loading ? <RiLoader4Line className="size-3.5 animate-spin" /> : <RiSearchLine className="size-3.5" />}
          {loading ? "查询中" : result ? "重新查询" : "查询"}
        </button>
      </div>

      {result ? <ResultPanel result={result} /> : null}
    </div>
  )
}

function ResultPanel({ result }: { result: LiveToolResponse }) {
  if (result.status !== "live") {
    const notConfigured = result.status === "not_configured"
    return (
      <p
        className={cn(
          "mt-2 flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-xs leading-5",
          notConfigured
            ? "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
            : "border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400",
        )}
      >
        <RiAlertLine className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {result.message ?? "查询失败"}
      </p>
    )
  }

  const d = result.data
  if (!d) return null

  return (
    <div className="mt-2 rounded-lg border bg-background p-2.5">
      <p className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <RiCheckboxCircleLine className="size-3.5" aria-hidden />
        真实数据 · {result.chain?.label}
        {result.latencyMs !== undefined ? ` · ${result.latencyMs}ms` : ""}
      </p>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
        <Fact label="区块高度" value={d.blockNumber.toLocaleString()} />
        <Fact
          label="区块时间"
          value={d.blockTime ? new Date(d.blockTime).toLocaleString() : "未取到"}
        />
        <Fact
          label="原生币余额"
          value={d.balanceEth === null ? "未查（未填地址）" : `${d.balanceEth} ETH`}
        />
        <Fact
          label="交易计数"
          value={d.txCount === null ? "未查（未填地址）" : String(d.txCount)}
        />
      </dl>

      {result.unknown && result.unknown.length > 0 ? (
        <p className="mt-2 text-[11px] leading-5 text-amber-600 dark:text-amber-400">
          未取到的项：{result.unknown.join("、")}
        </p>
      ) : null}

      <p className="mt-2 flex flex-wrap items-center gap-x-2 border-t pt-2 text-[11px] text-muted-foreground">
        <span>数据源：{result.source?.provider}</span>
        <span>方法：{result.source?.method}</span>
        {result.fetchedAt ? <span>抓取时间：{new Date(result.fetchedAt).toLocaleString()}</span> : null}
      </p>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate text-xs font-semibold tabular-nums" title={value}>
        {value}
      </dd>
    </div>
  )
}
