import { cache } from "react"
import type { RwaSnapshot } from "./types"
import { aggregateRwa, isDexProject, toSymbolTokens, type DexPoolEntry } from "./service"

/**
 * DefiLlama 拉取层（仅服务端调用）。
 *
 * 数据源：
 *   - GET https://api.llama.fi/protocols —— 协议级快照（TVL、分类、链、涨跌幅）
 *   - GET https://yields.llama.fi/pools  —— 池子级快照（用于分离二级市场 DEX 流动性）
 * 两者均为公开只读接口，无需 API Key。
 *
 * 缓存策略：
 *   Next.js Data Cache 对单个响应有 2MB 上限，而 pools 响应约 15MB、protocols 约 9MB，
 *   构建时会报 "items over 2MB can not be cached" 并静默放弃缓存——那等于每个请求重新拉 24MB。
 *   因此这里改为进程内缓存：拉取后立即裁剪成「RWA 协议 + DEX 池」的小对象再常驻（几十 KB），
 *   1 小时内复用；?refresh=1 强制回源。同一次请求内另用 React cache 去重。
 *
 * 纪律：上游不可用一律返回空快照（stale=true），绝不用演示数据伪装成真实数据。
 */

export const DEFILLAMA_PROTOCOLS_URL = "https://api.llama.fi/protocols"
export const DEFILLAMA_POOLS_URL = "https://yields.llama.fi/pools"

/** 页面级缓存时长（秒）；上游数据缓存由下方进程内缓存控制 */
export const RWA_REVALIDATE_SECONDS = 3600
export const RWA_CACHE_TAG = "rwa-defillama"

/** 上游快照在进程内的存活时长（毫秒） */
const UPSTREAM_TTL_MS = 60 * 60 * 1000

/** DefiLlama 协议条目（只取本层用到的字段） */
export type LlamaProtocol = {
  name?: string
  slug?: string
  category?: string
  tvl?: number
  chains?: string[]
  url?: string
  logo?: string
  /** 母协议名，用于归出发行方（如 Ondo 旗下多个产品） */
  parent_protocol?: string
  change_1d?: number | null
  change_7d?: number | null
}

/** DefiLlama 池子条目（只取本层用到的字段） */
export type LlamaPool = {
  pool?: string
  project?: string
  symbol?: string
  chain?: string
  tvlUsd?: number
  apy?: number | null
  /** 池子底层代币地址，用于构造 DEX 跳转链接 */
  underlyingTokens?: string[]
}

type UpstreamCache = {
  at: number
  protocols: LlamaProtocol[]
  dexPools: DexPoolEntry[]
}

let upstreamCache: UpstreamCache | null = null

const EMPTY_TOTALS = {
  protocolCount: 0,
  primaryTvlUsd: 0,
  secondaryTvlUsd: 0,
  secondarySharePct: 0,
  dexPoolCount: 0,
  permissionedIssuerCount: 0,
}

function unavailable(error: string): RwaSnapshot {
  return {
    assets: [],
    totals: EMPTY_TOTALS,
    source: "unavailable",
    fetchedAt: new Date().toISOString(),
    stale: true,
    error,
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    // 响应远超 Data Cache 的 2MB 上限，显式 no-store 避免走无效的缓存路径
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  })
  if (!response.ok) throw new Error(`UPSTREAM_${response.status}`)
  return (await response.json()) as T
}

/** 拉取上游并裁剪；命中进程内缓存时直接复用 */
async function loadUpstream(force: boolean): Promise<UpstreamCache> {
  const now = Date.now()
  if (!force && upstreamCache && now - upstreamCache.at < UPSTREAM_TTL_MS) {
    return upstreamCache
  }

  const [protocolPayload, poolPayload] = await Promise.all([
    fetchJson<LlamaProtocol[]>(DEFILLAMA_PROTOCOLS_URL),
    fetchJson<{ data?: LlamaPool[] }>(DEFILLAMA_POOLS_URL),
  ])

  const rawProtocols = Array.isArray(protocolPayload) ? protocolPayload : []
  const rawPools = Array.isArray(poolPayload?.data) ? poolPayload.data : []

  // 裁剪：只保留 RWA 协议与 DEX 池的必要字段，常驻内存从 ~24MB 降到几十 KB
  const protocols: LlamaProtocol[] = rawProtocols
    .filter((item) => (item.category ?? "").toLowerCase().includes("rwa"))
    .map((item) => ({
      name: item.name,
      slug: item.slug,
      category: item.category,
      tvl: item.tvl,
      chains: item.chains,
      url: item.url,
      logo: item.logo,
      parent_protocol: item.parent_protocol,
      change_1d: item.change_1d,
      change_7d: item.change_7d,
    }))

  const dexPools: DexPoolEntry[] = []
  for (const item of rawPools) {
    if (!isDexProject(item.project)) continue
    dexPools.push({
      pool: {
        pool: item.pool,
        project: item.project,
        symbol: item.symbol,
        chain: item.chain,
        tvlUsd: item.tvlUsd,
        apy: item.apy,
        underlyingTokens: item.underlyingTokens,
      },
      tokens: toSymbolTokens(item.symbol ?? ""),
    })
  }

  upstreamCache = { at: now, protocols, dexPools }
  return upstreamCache
}

/**
 * 获取 RWA 聚合快照。
 * 用 React cache 在同一次渲染周期内去重，避免重复聚合。
 */
export const getRwaSnapshot = cache(
  async (options?: { force?: boolean }): Promise<RwaSnapshot> => {
    let upstream: UpstreamCache
    try {
      upstream = await loadUpstream(Boolean(options?.force))
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN_ERROR"
      console.error("[rwa] 拉取 DefiLlama 失败:", message)
      return unavailable(message)
    }

    if (upstream.protocols.length === 0) {
      return unavailable("UPSTREAM_EMPTY")
    }

    try {
      const { assets, totals } = aggregateRwa(upstream.protocols, upstream.dexPools)
      if (assets.length === 0) {
        return unavailable("NO_RWA_PROTOCOLS")
      }
      return {
        assets,
        totals,
        source: "defillama",
        fetchedAt: new Date().toISOString(),
        stale: false,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "AGGREGATE_FAILED"
      console.error("[rwa] 聚合失败:", message)
      return unavailable(message)
    }
  },
)

/** 按 slug 查找单个资产 */
export async function getRwaAssetById(id: string) {
  const snapshot = await getRwaSnapshot()
  return snapshot.assets.find((asset) => asset.id === id) ?? null
}
