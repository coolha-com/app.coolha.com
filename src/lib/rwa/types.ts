/**
 * RWA（代币化真实资产）数据层类型定义。
 *
 * 关键设计：代币化资产的流动性天然分成两层，必须分开计量，不能混为一谈。
 *   - 一级市场（primary）：发行方申购 / 赎回（subscription / redemption）口径，
 *     以协议 TVL 代表。绝大多数 RWA 资产的流动性都在这里。
 *   - 二级市场（secondary）：DEX / AMM 池子口径，可自由转让的部分才有。
 *     主流 RWA 多为许可型代币（转账白名单 + transfer agent 限制），进不了普通 AMM。
 *
 * 实测（2026-10-15，DefiLlama）：102 个 RWA 协议合计 TVL 约 41 亿美元，
 * 而其中能在 DEX 上找到池子的合计约 3341 万美元，占比约 0.82%。
 * 因此本层把「二级市场占比」作为一等公民字段暴露出来。
 *
 * 跳转设计也随之分叉：
 *   - 一级市场 → 发行方官网（申购 / 赎回 / 白名单申请）
 *   - 二级市场 → Uniswap（按链与代币地址构造 swap 链接）
 * 本层只做外链跳转，不自持订单簿、不托管资产、不代客下单。
 */

/** 底层资产类别（由协议名 / slug 关键词推断，非发行方官方披露） */
export type RwaAssetClass =
  | "国债 / 货币市场"
  | "私人信贷"
  | "贵金属"
  | "房地产"
  | "股票 / 股权"
  | "基金份额"
  | "大宗商品 / 碳信用"
  | "RWA 背书稳定币"
  | "其他代币化资产"

/** 二级市场池子（DEX / AMM） */
export type RwaDexPool = {
  /** DefiLlama 的 DEX 项目标识，如 uniswap-v3 */
  project: string
  symbol: string
  chain: string
  tvlUsd: number
  apy: number | null
  /** 用于构造 DEX 跳转链接的代币地址（取池子底层资产中匹配到的那个） */
  tokenAddress: string | null
  /** 该池在 Uniswap 的 swap 链接；链不受支持时为 null */
  swapUrl: string | null
}

/** 单个 RWA 资产（协议级聚合视图） */
export type RwaAsset = {
  /** 站内 slug，与 DefiLlama 的 protocol slug 一致 */
  id: string
  name: string
  category: string
  /** 协议 / 代币图标（DefiLlama icons） */
  logoUrl: string | null
  /** 发行方名称：优先取 DefiLlama 的 parent_protocol，其次协议名 */
  issuerName: string
  issuerLogoUrl: string | null
  /** 发行方官网：一级市场申购 / 赎回入口 */
  issuerUrl: string | null
  /** 底层资产类别（关键词推断） */
  assetClass: RwaAssetClass
  /** 一级市场口径：协议 TVL（美元） */
  primaryTvlUsd: number
  /** 二级市场口径：DEX 池 TVL 合计（美元），无池子时为 0 */
  secondaryTvlUsd: number
  /** 二级 / 一级占比（百分比）。0 表示仅有一级市场申赎 */
  secondarySharePct: number
  /** 匹配到的 DEX 池数量 */
  dexPoolCount: number
  chains: string[]
  /** 链图标（与 chains 同序；个别链名可能无图标，为 null） */
  chainLogos: (string | null)[]
  change1dPct: number | null
  change7dPct: number | null
  /** 该发行方是否已公开接入 Uniswap v4 Permissioned Pools */
  permissionedPoolIssuer: boolean
  /** 主流二级市场入口：有 DEX 池时指向 Uniswap，否则回落到发行方官网 */
  primaryActionUrl: string | null
  primaryActionLabel: string | null
  /** 按 TVL 排序的前若干个 DEX 池明细 */
  topDexPools: RwaDexPool[]
}

/** 汇总指标，用于页面顶部概览 */
export type RwaTotals = {
  protocolCount: number
  primaryTvlUsd: number
  secondaryTvlUsd: number
  /** 二级 / 一级总占比（百分比） */
  secondarySharePct: number
  dexPoolCount: number
  /** 已公开接入 Permissioned Pools 的发行方数量 */
  permissionedIssuerCount: number
}

export type RwaSource = "defillama" | "unavailable"

export interface RwaSnapshot {
  assets: RwaAsset[]
  totals: RwaTotals
  source: RwaSource
  fetchedAt: string
  /** true = 上游不可用，当前为空快照，绝不用演示数据填充 */
  stale: boolean
  error?: string
}

/** 列表页排序键 */
export type RwaSort =
  | "primary-desc"
  | "secondary-desc"
  | "secondary-share-desc"
  | "name-asc"
  | "change1d-desc"

export const RWA_SORTS: readonly RwaSort[] = [
  "primary-desc",
  "secondary-desc",
  "secondary-share-desc",
  "name-asc",
  "change1d-desc",
]

export function isRwaSort(value: string): value is RwaSort {
  return (RWA_SORTS as readonly string[]).includes(value)
}

/** 代币化股票 / ETF / 大宗商品行情板 */
export type TickerCategory = "stocks" | "etfs" | "commodities"

export const TICKER_CATEGORIES: readonly TickerCategory[] = ["stocks", "etfs", "commodities"]

export function isTickerCategory(value: string): value is TickerCategory {
  return (TICKER_CATEGORIES as readonly string[]).includes(value)
}

export type TokenizedTicker = {
  id: string
  symbol: string
  name: string
  image: string | null
  priceUsd: number | null
  change1hPct: number | null
  change24hPct: number | null
  marketCapUsd: number | null
  volume24hUsd: number | null
  rank: number | null
  /** 发行方显示名（由代币名解析，如 Ondo / bStocks / xStocks / Coinbase） */
  issuer: string | null
  /** 该代币部署的链（CoinGecko platform key 归一化后的显示名） */
  chains: string[]
  /** 底层标的名（去掉发行方后缀与括号后的名称） */
  underlying: string
}

/**
 * 同一底层标的的多个代币化版本归组。
 * 例：Circle 同时有 CRCLB(bStocks) / CRCLON(Ondo) / CRCLX(xStocks)，
 * 发行方与所在链都不同，需要并排展示。
 */
export type TickerGroup = {
  key: string
  /** 显示名：取组内最完整的名称 */
  name: string
  /** 该标的的所有代币化版本，按市值降序 */
  versions: TokenizedTicker[]
  /** 去重后的发行方 */
  issuers: string[]
  /** 去重后的链 */
  chains: string[]
  totalMarketCapUsd: number
}

export type TickerBoardData = Record<TickerCategory, TokenizedTicker[]>

export type TickerGroupBoard = Record<TickerCategory, TickerGroup[]>
