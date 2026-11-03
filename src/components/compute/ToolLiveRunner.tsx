"use client"

import { useState } from "react"
import {
  RiAlertLine,
  RiCheckboxCircleLine,
  RiLoader4Line,
  RiSearchLine,
} from "react-icons/ri"
import { cn } from "@/lib/utils"

/** 工具层证据信封的前端视图（只声明用到的字段，服务端类型见 src/lib/web3-tools/evidence.ts） */
interface ToolSourceView {
  provider: string
  method: string
  endpoint: string
  chain: string
  chainId: number
  fetchedAt: string
  latencyMs: number
}

interface ToolCoverageView {
  requestedWindow?: string
  truncated?: boolean
  returnedItems?: number
  note?: string
}

interface ToolResultView {
  ok: boolean
  tool: string
  source: ToolSourceView
  data: {
    chain: string
    chainId: number
    label: string
    blockNumber: number
    blockTime: string | null
    address: string | null
    balanceEth: number | null
    balanceWei: string | null
    txCount: number | null
  } | null
  warnings: string[]
  unknown: string[]
  coverage?: ToolCoverageView
  error?: { code: string; message: string; retryable?: boolean }
}

interface LiveToolResponse {
  status:
    | "live"
    | "not_configured"
    | "not_integrated"
    | "upstream_error"
    | "invalid_request"
    | "rate_limited"
  message?: string
  result?: ToolResultView
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
 * 诚实纪律：
 * - 拿不到就如实显示「未配置 / 上游不可用」，不显示任何占位数值。
 * - 展示证据信封的 source（数据源/方法/端点/链/抓取时间/延迟）。
 * - 展示 coverage（覆盖边界）与 unknown（没查到的项），不把「没查到」藏起来。
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
  const envelope = result.result
  const d = envelope?.data ?? null

  if (result.status !== "live" || !envelope || !d) {
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

  return (
    <div className="mt-2 rounded-lg border bg-background p-2.5">
      <p className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <RiCheckboxCircleLine className="size-3.5" aria-hidden />
        真实数据 · {d.label}
        {envelope.source.latencyMs !== undefined ? ` · ${envelope.source.latencyMs}ms` : ""}
      </p>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
        <Fact label="区块高度" value={d.blockNumber.toLocaleString()} />
        <Fact
          label="区块时间"
          value={d.blockTime ? new Date(d.blockTime).toLocaleString() : "未取到"}
        />
        <Fact
          label="原生币余额"
          value={d.balanceEth === null ? "未取到" : `${d.balanceEth} ETH`}
        />
        <Fact label="交易计数" value={d.txCount === null ? "未取到" : String(d.txCount)} />
      </dl>

      {envelope.unknown.length > 0 ? (
        <p className="mt-2 text-[11px] leading-5 text-amber-600 dark:text-amber-400">
          未取到的项：{envelope.unknown.join("、")}
        </p>
      ) : null}

      {envelope.warnings.length > 0 ? (
        <p className="mt-1 text-[11px] leading-5 text-amber-600 dark:text-amber-400">
          口径提醒：{envelope.warnings.join("；")}
        </p>
      ) : null}

      {envelope.coverage?.note ? (
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          覆盖边界：{envelope.coverage.note}
        </p>
      ) : null}

      <p className="mt-2 flex flex-wrap items-center gap-x-2 border-t pt-2 text-[11px] text-muted-foreground">
        <span>数据源：{envelope.source.provider}</span>
        <span>方法：{envelope.source.method}</span>
        <span>端点：{envelope.source.endpoint}</span>
        <span>链 ID：{envelope.source.chainId}</span>
        {envelope.source.fetchedAt ? (
          <span>抓取时间：{new Date(envelope.source.fetchedAt).toLocaleString()}</span>
        ) : null}
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
