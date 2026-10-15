"use client"

import { Fragment, useState } from "react"
import { RiArrowDownSLine, RiArrowRightUpLine, RiArrowUpSLine } from "react-icons/ri"
import { cn } from "@/lib/utils"
import type { TickerCategory, TickerGroupBoard, TokenizedTicker } from "@/lib/rwa/types"

/**
 * 代币化股票 / ETF / 大宗商品行情板。
 *
 * 同一底层标的常有多个发行方版本（Circle 同时有 bStocks / Ondo / xStocks 三个版本，
 * 链也各不相同），因此按标的归组展示：主行显示聚合信息，展开后看到每个版本的
 * 发行方、所在链、价格与涨跌。
 *
 * 免责声明（与 Uniswap 官方探索页同口径）：代币追踪标的资产价格，但并非股票或商品本身。
 * 发行方与标的名由代币名解析得出，非发行方官方披露。
 */

const TABS: ReadonlyArray<{ key: TickerCategory; label: string }> = [
  { key: "stocks", label: "股票" },
  { key: "etfs", label: "ETF" },
  { key: "commodities", label: "大宗商品" },
]

/** 折叠前默认展示的标的数量 */
const INITIAL_ROWS = 40

function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—"
  if (value >= 1000) return `US$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
  if (value >= 1) return `US$${value.toFixed(2)}`
  return `US$${value.toFixed(4)}`
}

function formatCompact(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return "—"
  if (value >= 100_000_000) return `US$${(value / 100_000_000).toFixed(1)}亿`
  if (value >= 10_000) return `US$${(value / 10_000).toFixed(0)}万`
  return `US$${value.toFixed(0)}`
}

function Change({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) return <span className="text-muted-foreground">—</span>
  const up = value >= 0
  return (
    <span className={cn("tabular-nums", up ? "text-green-600" : "text-red-600")}>
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(2)}%
    </span>
  )
}

function Chips({ items, max = 3 }: { items: string[]; max?: number }) {
  if (items.length === 0) return <span className="text-xs text-muted-foreground">—</span>
  const shown = items.slice(0, max)
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((item) => (
        <span key={item} className="rounded bg-muted px-1.5 py-0.5 text-[11px] leading-4 text-muted-foreground">
          {item}
        </span>
      ))}
      {items.length > shown.length ? (
        <span className="text-[11px] leading-4 text-muted-foreground">+{items.length - shown.length}</span>
      ) : null}
    </span>
  )
}

function TickerLogo({ src, name, symbol, size = 28 }: { src: string | null; name: string; symbol: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (failed || !src) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground"
      >
        {(symbol || name || "?").charAt(0)}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full bg-muted object-contain"
      onError={() => setFailed(true)}
    />
  )
}

function VersionRow({ ticker }: { ticker: TokenizedTicker }) {
  return (
    <tr className="border-t border-dashed">
      <td className="py-2 pl-9 pr-3">
        <div className="flex items-center gap-2">
          <TickerLogo src={ticker.image} name={ticker.name} symbol={ticker.symbol} size={20} />
          <span className="text-xs text-muted-foreground">{ticker.symbol}</span>
          <span className="truncate text-xs">{ticker.name}</span>
        </div>
      </td>
      <td className="hidden px-3 py-2 lg:table-cell">
        <span className="text-xs">{ticker.issuer ?? "—"}</span>
      </td>
      <td className="hidden px-3 py-2 xl:table-cell">
        <Chips items={ticker.chains} max={4} />
      </td>
      <td className="px-3 py-2 text-right text-xs tabular-nums">{formatPrice(ticker.priceUsd)}</td>
      <td className="hidden px-3 py-2 text-right text-xs lg:table-cell">
        <Change value={ticker.change1hPct} />
      </td>
      <td className="px-3 py-2 text-right text-xs">
        <Change value={ticker.change24hPct} />
      </td>
      <td className="hidden px-3 py-2 text-right text-xs tabular-nums md:table-cell">
        {formatCompact(ticker.marketCapUsd)}
      </td>
      <td className="hidden px-3 py-2 text-right text-xs tabular-nums xl:table-cell">
        {formatCompact(ticker.volume24hUsd)}
      </td>
      <td className="pl-3 py-2 text-right">
        <a
          href={`https://www.coingecko.com/en/coins/${ticker.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition hover:text-primary"
        >
          行情 <RiArrowRightUpLine className="size-3.5" />
        </a>
      </td>
    </tr>
  )
}

export function TickerBoard({ board }: { board: TickerGroupBoard }) {
  const [active, setActive] = useState<TickerCategory>("stocks")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  const groups = board[active] ?? []
  const shown = showAll ? groups : groups.slice(0, INITIAL_ROWS)
  const versionTotal = groups.reduce((sum, group) => sum + group.versions.length, 0)

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="行情分类">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => {
              setActive(tab.key)
              setShowAll(false)
            }}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-sm transition",
              active === tab.key
                ? "bg-primary font-medium text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            <span className="ml-1.5 text-xs opacity-70">{(board[tab.key] ?? []).length}</span>
          </button>
        ))}
        <span className="ml-auto text-xs leading-5 text-muted-foreground">
          代币追踪标的资产价格，但并非股票或商品本身。
        </span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-2.5 pr-3 text-left font-medium">标的</th>
              <th className="hidden px-3 py-2.5 text-left font-medium lg:table-cell">发行方</th>
              <th className="hidden px-3 py-2.5 text-left font-medium xl:table-cell">所在链</th>
              <th className="px-3 py-2.5 text-right font-medium">价格</th>
              <th className="hidden px-3 py-2.5 text-right font-medium lg:table-cell">1 小时</th>
              <th className="px-3 py-2.5 text-right font-medium">1 天</th>
              <th className="hidden px-3 py-2.5 text-right font-medium md:table-cell">市值</th>
              <th className="hidden px-3 py-2.5 text-right font-medium xl:table-cell">24h 成交</th>
              <th className="pl-3 py-2.5 text-right font-medium">详情</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                  暂无数据。上游恢复后会在此展示。
                </td>
              </tr>
            ) : (
              shown.map((group) => {
                const isOpen = expanded.has(group.key)
                const lead = group.versions[0]
                return (
                  <Fragment key={group.key}>
                    <tr className="border-b last:border-b-0">
                      <td className="py-2.5 pr-3">
                        <button
                          type="button"
                          onClick={() => toggle(group.key)}
                          aria-expanded={isOpen}
                          className="flex items-center gap-2 text-left"
                        >
                          {group.versions.length > 1 ? (
                            isOpen ? (
                              <RiArrowUpSLine className="size-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <RiArrowDownSLine className="size-4 shrink-0 text-muted-foreground" />
                            )
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          <TickerLogo src={lead.image} name={group.name} symbol={lead.symbol} />
                          <span>
                            <span className="font-medium">{group.name || "—"}</span>
                            {group.versions.length > 1 ? (
                              <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                {group.versions.length} 个版本
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </td>
                      <td className="hidden px-3 py-2.5 lg:table-cell">
                        <Chips items={group.issuers} max={2} />
                      </td>
                      <td className="hidden px-3 py-2.5 xl:table-cell">
                        <Chips items={group.chains} max={3} />
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatPrice(lead.priceUsd)}</td>
                      <td className="hidden px-3 py-2.5 text-right text-xs lg:table-cell">
                        <Change value={lead.change1hPct} />
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs">
                        <Change value={lead.change24hPct} />
                      </td>
                      <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell">
                        {formatCompact(group.totalMarketCapUsd)}
                      </td>
                      <td className="hidden px-3 py-2.5 text-right tabular-nums xl:table-cell">
                        {formatCompact(lead.volume24hUsd)}
                      </td>
                      <td className="pl-3 py-2.5 text-right">
                        <a
                          href={`https://www.coingecko.com/en/coins/${lead.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition hover:text-primary"
                        >
                          行情 <RiArrowRightUpLine className="size-3.5" />
                        </a>
                      </td>
                    </tr>
                    {isOpen
                      ? group.versions.map((ticker) => <VersionRow key={ticker.id} ticker={ticker} />)
                      : null}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {groups.length > INITIAL_ROWS ? (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            共 {groups.length} 个标的 / {versionTotal} 个代币版本
          </span>
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="rounded-lg border px-2.5 py-1 transition hover:border-primary/60 hover:text-primary"
          >
            {showAll ? "收起" : `显示全部 ${groups.length} 个`}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          共 {groups.length} 个标的 / {versionTotal} 个代币版本
        </p>
      )}
    </div>
  )
}
