import { cache } from "react"
import type { TickerBoardData, TickerCategory, TickerGroup, TickerGroupBoard, TokenizedTicker } from "./types"
import { TICKER_CATEGORIES } from "./types"

/**
 * 代币化股票 / ETF / 大宗商品行情板（CoinGecko 公开接口，无需 Key）。
 *
 * 数据分两路：
 *   1. /coins/markets  —— 按 category 拿行情（价格、涨跌幅、市值、成交量、图标）
 *   2. /coins/list?include_platform=true —— 拿每个币部署在哪些链（3.8MB，缓存 24 小时）
 * 实测 2026-10-15：tokenized-stock 分类单页可返回 250 条，链映射命中率 250/250。
 *
 * 发行方与底层标的名由代币名解析（CoinGecko 不提供这两个字段），属推断，页面需注明。
 *
 * 重要口径：这些代币**追踪**股票 / 商品价格，但并非股票或商品本身
 * （Uniswap 官方探索页的同款表述）。
 */

const CG_BASE = "https://api.coingecko.com/api/v3"
const CG_MARKETS_URL = `${CG_BASE}/coins/markets`
const CG_PLATFORMS_URL = `${CG_BASE}/coins/list?include_platform=true`

/** 单页上限：CoinGecko 免费档 per_page 最大 250 */
const PER_PAGE = 250
/** 行情板缓存时长 */
const MARKET_TTL_MS = 10 * 60 * 1000
/** 链映射缓存时长（/coins/list 体积大且变化慢） */
const PLATFORM_TTL_MS = 24 * 60 * 60 * 1000

/** 发行方解析规则：优先匹配括号内的官方标注，再退回品牌词 */
const ISSUER_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\(ondo tokenized(?: stock)?\)/i, "Ondo"],
  [/\(bstocks tokenized stock\)/i, "bStocks"],
  [/xstock/i, "xStocks"],
  [/\(reality\)/i, "Reality"],
  [/\(coinbase tokenized stocks?\)/i, "Coinbase"],
  [/\(dinari tokenized stock\)/i, "Dinari"],
  [/\(backpack securities\)/i, "Backpack"],
  [/\(securitize/i, "Securitize"],
  [/\(superstate/i, "Superstate"],
]

/** CoinGecko platform key → 展示名 */
const CHAIN_LABELS: Readonly<Record<string, string>> = {
  ethereum: "Ethereum",
  solana: "Solana",
  "binance-smart-chain": "BNB Chain",
  "arbitrum-one": "Arbitrum",
  "polygon-pos": "Polygon",
  base: "Base",
  optimism: "Optimism",
  avalanche: "Avalanche",
  hyperevm: "HyperEVM",
  sui: "Sui",
  aptos: "Aptos",
  stellar: "Stellar",
  algorand: "Algorand",
  hedera: "Hedera",
  "xdai": "Gnosis",
}

function chainLabel(platformKey: string): string {
  return (
    CHAIN_LABELS[platformKey] ??
    platformKey
      .split(/[-_]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  )
}

/** 去掉括号与发行方后缀，得到底层标的名 */
function extractUnderlying(name: string): string {
  return name
    .replace(/\([^)]*\)/g, "")
    .replace(/\bxstocks?\b/gi, "")
    .replace(/\btokenized\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

function parseIssuer(name: string): string | null {
  for (const [pattern, label] of ISSUER_PATTERNS) {
    if (pattern.test(name)) return label
  }
  return null
}

type CgMarket = {
  id?: string
  symbol?: string
  name?: string
  image?: string
  current_price?: number | null
  price_change_percentage_1h_in_currency?: number | null
  price_change_percentage_24h_in_currency?: number | null
  market_cap?: number | null
  total_volume?: number | null
  market_cap_rank?: number | null
}

type CgPlatformEntry = { id?: string; platforms?: Record<string, string> }

let platformCache: { at: number; map: Map<string, string[]> } | null = null

/**
 * 载入「币 → 链」映射。volume 大（3.8MB），缓存 24 小时；
 * 失败时降级为空映射（行情照常展示，链列显示为空）。
 */
async function loadPlatforms(): Promise<Map<string, string[]>> {
  if (platformCache && Date.now() - platformCache.at < PLATFORM_TTL_MS) {
    return platformCache.map
  }
  try {
    const response = await fetch(CG_PLATFORMS_URL, {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`PLATFORM_${response.status}`)
    const raw = (await response.json()) as CgPlatformEntry[]
    const map = new Map<string, string[]>()
    for (const item of raw) {
      if (!item.id || !item.platforms) continue
      const chains = Object.keys(item.platforms).filter((key) => Boolean(item.platforms?.[key]))
      if (chains.length > 0) map.set(item.id, chains.map(chainLabel))
    }
    platformCache = { at: Date.now(), map }
    return map
  } catch (error) {
    const message = error instanceof Error ? error.message : "PLATFORM_FAILED"
    console.error("[rwa-markets] 链映射拉取失败:", message)
    return platformCache?.map ?? new Map()
  }
}

function toTicker(item: CgMarket, chains: string[]): TokenizedTicker {
  const name = item.name ?? ""
  return {
    id: item.id ?? "",
    symbol: (item.symbol ?? "").toUpperCase(),
    name,
    image: item.image ?? null,
    priceUsd: typeof item.current_price === "number" ? item.current_price : null,
    change1hPct:
      typeof item.price_change_percentage_1h_in_currency === "number"
        ? item.price_change_percentage_1h_in_currency
        : null,
    change24hPct:
      typeof item.price_change_percentage_24h_in_currency === "number"
        ? item.price_change_percentage_24h_in_currency
        : null,
    marketCapUsd: typeof item.market_cap === "number" ? item.market_cap : null,
    volume24hUsd: typeof item.total_volume === "number" ? item.total_volume : null,
    rank: typeof item.market_cap_rank === "number" ? item.market_cap_rank : null,
    issuer: parseIssuer(name),
    chains,
    underlying: extractUnderlying(name),
  }
}

async function fetchCategory(categoryId: string, platforms: Map<string, string[]>): Promise<TokenizedTicker[]> {
  const response = await fetch(
    `${CG_MARKETS_URL}?vs_currency=usd&category=${categoryId}&per_page=${PER_PAGE}&page=1&price_change_percentage=1h,24h`,
    {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    },
  )
  if (!response.ok) throw new Error(`COINGECKO_${response.status}`)
  const raw = (await response.json()) as CgMarket[]
  if (!Array.isArray(raw)) throw new Error("COINGECKO_SHAPE")
  return raw
    .map((item) => toTicker(item, platforms.get(item.id ?? "") ?? []))
    .filter((ticker) => ticker.id.length > 0)
}

/** 分组键：底层标的名的首词（Circle / Circle Internet Group 归为同一标的） */
function groupKey(underlying: string): string {
  return underlying.toLowerCase().split(/\s+/)[0] ?? underlying.toLowerCase()
}

/** 同标的多个版本归组：发行方与链可能是多个 */
export function groupTickers(tickers: TokenizedTicker[]): TickerGroup[] {
  const buckets = new Map<string, TokenizedTicker[]>()
  for (const ticker of tickers) {
    const key = groupKey(ticker.underlying)
    const list = buckets.get(key) ?? []
    list.push(ticker)
    buckets.set(key, list)
  }

  const groups: TickerGroup[] = []
  for (const [key, list] of buckets) {
    list.sort((a, b) => (b.marketCapUsd ?? 0) - (a.marketCapUsd ?? 0))
    const name = [...list]
      .map((ticker) => ticker.underlying)
      .sort((a, b) => b.length - a.length)[0]
    groups.push({
      key,
      name: name || key,
      versions: list,
      issuers: [...new Set(list.map((t) => t.issuer).filter((v): v is string => Boolean(v)))],
      chains: [...new Set(list.flatMap((t) => t.chains))],
      totalMarketCapUsd: list.reduce((sum, t) => sum + (t.marketCapUsd ?? 0), 0),
    })
  }

  return groups.sort((a, b) => b.totalMarketCapUsd - a.totalMarketCapUsd)
}

export function toGroupBoard(board: TickerBoardData): TickerGroupBoard {
  return {
    stocks: groupTickers(board.stocks ?? []),
    etfs: groupTickers(board.etfs ?? []),
    commodities: groupTickers(board.commodities ?? []),
  }
}

export type TickerBoardResult = {
  board: TickerBoardData
  fetchedAt: string
  stale: boolean
  error?: string
}

let marketCache: { at: number; result: TickerBoardResult } | null = null
/** 上一份成功数据（按分类保留），用于限速失败时兜底，避免把空板展示给用户 */
let lastGood: TickerBoardData | null = null

function emptyBoard(): TickerBoardData {
  return { stocks: [], etfs: [], commodities: [] }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 获取三个分类的行情板；进程内缓存 10 分钟。
 * 任一分类失败不影响其他分类（各自独立降级为空数组）。
 */
export const getTickerBoard = cache(
  async (options?: { force?: boolean }): Promise<TickerBoardResult> => {
    if (!options?.force && marketCache && Date.now() - marketCache.at < MARKET_TTL_MS) {
      return marketCache.result
    }

    const board = emptyBoard()
    let failure: string | undefined
    const platforms = await loadPlatforms()

    // 串行并间隔请求：CoinGecko 免费档限速很紧（实测并发 3 个必触发 429），
    // 并发改成串行 + 1.2s 间隔后基本稳定；平台映射另走 24 小时缓存，不占这里的配额。
    for (const category of TICKER_CATEGORIES) {
      try {
        board[category] = await fetchCategory(categoryIdOf(category), platforms)
        if (lastGood) lastGood[category] = board[category]
      } catch (error) {
        failure = error instanceof Error ? error.message : "COINGECKO_FAILED"
        console.error(`[rwa-markets] ${category} 拉取失败:`, failure)
        // 用上一份成功数据兜底，而不是把空数组展示给用户
        const fallback = lastGood?.[category]
        if (fallback && fallback.length > 0) board[category] = fallback
      }
      await sleep(1200)
    }
    if (!lastGood) lastGood = board

    const result: TickerBoardResult = {
      board,
      fetchedAt: new Date().toISOString(),
      stale: Boolean(failure),
      ...(failure ? { error: failure } : {}),
    }
    // 部分失败也缓存，避免限速风暴下反复重试上游
    marketCache = { at: Date.now(), result }
    return result
  },
)

function categoryIdOf(category: TickerCategory): string {
  switch (category) {
    case "stocks":
      return "tokenized-stock"
    case "etfs":
      return "tokenized-exchange-traded-funds-etfs"
    case "commodities":
      return "tokenized-commodities"
  }
}
