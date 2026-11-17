"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CHAIN_REGISTRY, chainDisplayStatus, connectedChains } from "@/lib/chains/registry"
import { STRUCTURAL_GAPS } from "@/lib/rwa/sections"
import type { ResearchReport } from "@/lib/rwa/report"

interface ResearchResponse {
  status: string
  message?: string
  report?: ResearchReport
}

const STATUS_LABEL = {
  observed: "已观测",
  partial: "部分",
  gap: "缺口",
} as const

export function RwaResearchPanel() {
  const [chain, setChain] = useState(connectedChains()[0]?.key ?? "ethereum")
  const [address, setAddress] = useState("")
  const [holder, setHolder] = useState("")
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ResearchResponse | null>(null)

  async function readToken() {
    setBusy(true)
    try {
      const response = await fetch("/api/rwa/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain,
          address: address.trim(),
          holder: holder.trim() || undefined,
        }),
      })
      const body = (await response.json()) as ResearchResponse
      setResult(body)
    } catch {
      setResult({ status: "upstream_error", message: "请求失败，本次没有链上数据。" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 text-lg font-semibold">RWA Agent 数据边界</h2>
        <Badge variant="outline">收银台未接通</Badge>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        priority 是接入顺序，不是投资排名。未接入的链不会发起读取。链上持有份额不等于发行方声明的底层权益，也不等于用户依法享有的权益。
      </p>

      <ul className="mt-4 flex flex-wrap gap-2">
        {CHAIN_REGISTRY.map((entry) => (
          <li key={entry.key} className="min-w-0">
            <Badge
              variant={chainDisplayStatus(entry) === "已接通" ? "secondary" : "outline"}
              className="max-w-full"
            >
              {entry.priority}. {entry.label} · {chainDisplayStatus(entry)}
            </Badge>
          </li>
        ))}
      </ul>

      <ul className="mt-4 space-y-2 text-sm leading-6">
        {STRUCTURAL_GAPS.map((gap) => (
          <li key={gap.id} className="rounded-xl border px-3 py-2">
            <Badge variant="outline">缺口</Badge>
            <span className="ml-2 font-medium">{gap.title}</span>
            <p className="mt-1 text-muted-foreground">{gap.body}</p>
          </li>
        ))}
      </ul>

      <form
        className="mt-4 grid gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void readToken()
        }}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 text-sm sm:w-auto">
            <span className="mb-1 block text-xs text-muted-foreground">可发起读取的链</span>
            <select
              className="h-11 w-full rounded-xl border bg-background px-3 text-sm sm:h-9"
              value={chain}
              onChange={(event) => setChain(event.target.value)}
            >
              {connectedChains().map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0 flex-1 text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">代币合约</span>
            <input
              className="h-11 w-full rounded-xl border bg-background px-3 text-sm sm:h-9"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="0x"
              aria-label="代币合约地址"
              spellCheck={false}
            />
          </label>
        </div>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">可选：单个持有地址（不计算排名）</span>
          <input
            className="h-11 w-full rounded-xl border bg-background px-3 text-sm sm:h-9"
            value={holder}
            onChange={(event) => setHolder(event.target.value)}
            placeholder="留空则不计算占比"
            aria-label="单个持有地址"
            spellCheck={false}
          />
        </label>
        <Button type="submit" disabled={busy || address.trim().length < 42}>
          {busy ? "读取中" : "读取代币基础信息"}
        </Button>
      </form>

      {result ? (
        <div className="mt-4 space-y-2">
          <p className="text-sm">{result.message ?? result.status}</p>
          {result.report?.sections.map((item) => (
            <article key={item.id} className="rounded-xl border px-3 py-2 text-sm leading-6">
              <Badge variant={item.status === "gap" ? "outline" : "secondary"}>
                {STATUS_LABEL[item.status]}
              </Badge>
              <span className="ml-2 font-medium">{item.title}</span>
              <p className="mt-1 text-muted-foreground">{item.body}</p>
            </article>
          ))}
          {result.report ? (
            <p className="text-xs leading-5 text-muted-foreground">{result.report.disclaimer}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
