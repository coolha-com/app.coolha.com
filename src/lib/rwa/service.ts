import type { LlamaPool, LlamaProtocol } from "./client"
import type { RwaAsset, RwaAssetClass, RwaDexPool, RwaSort, RwaTotals } from "./types"

/**
 * RWA 聚合层：把 DefiLlama 的协议快照与池子快照合并成「一级市场 / 二级市场」双口径视图。
 */

/**
 * 已知 DEX / AMM 项目（DefiLlama 的 project 标识）。
 * 只有这些项目下的池子才计入「二级市场流动性」——协议自己名下的 vault 属于一级市场申赎，
 * 把它们加进来会把 TVL 重复计算（实测池子口径合计可达协议 TVL 的 3 倍以上）。
 */
const DEX_PROJECTS = new Set([
  "aerodrome",
  "aerodrome-slipstream",
  "ambient",
  "balancer-v2",
  "balancer-v3",
  "bancor-v3",
  "camelot-v2",
  "camelot-v3",
  "clipper",
  "curve-dex",
  "dodo",
  "hashflow",
  "kyberswap",
  "kyberswap-classic",
  "maverick",
  "meteora",
  "meteora-dlmm",
  "orca",
  "pancakeswap-amm",
  "pancakeswap-amm-v3",
  "raydium",
  "raydium-clmm",
  "solidly",
  "solidly-v3",
  "sushiswap",
  "sushiswap-v3",
  "thruster",
  "trader-joe-v2",
  "uniswap-v2",
  "uniswap-v3",
  "uniswap-v4",
  "velodrome",
  "velodrome-v3",
  "equalizer-exchange",
])

/** 匹配关键词时排除的通用词：命中它们只会带来误匹配 */
const STOP_WORDS = new Set([
  "assets", "asset", "capital", "protocol", "finance", "network", "tokens", "token",
  "vault", "vaults", "fund", "funds", "money", "market", "markets", "real", "world",
  "digital", "group", "global", "credit", "treasury", "income", "value", "stable",
  "stablecoin", "dao", "labs", "tech", "systems", "partners", "holdings", "management",
  "trust", "bank", "yield", "the", "and", "defi", "chain", "us", "one", "tokenized",
])

/**
 * 通用资产符号黑名单。
 *
 * 这一层是第一版实现里踩过的坑：协议名「USD AI」会派生出关键词 usd，
 * 用「symbol 包含关键词」去匹配时命中了全 DeFi 的稳定币池，单个协议被算进
 * 2273 个池、29.5 亿美元，二级占比冲到 217%——指标完全失真。
 *
 * 因此：稳定币、主流币、治理代币、以及 rwa 这类大类词一律排除。
 * 宁可漏匹配（如实显示该资产没有二级市场），不可误匹配（把无关池子算成 RWA 流动性）。
 */
const GENERIC_SYMBOLS = new Set([
  // 稳定币 / 现金类
  "usd", "usdc", "usdt", "dai", "frax", "lusd", "susd", "gho", "crvusd", "usde",
  "susde", "tusd", "busd", "usdd", "fdusd", "pyusd", "usd0", "usdai", "eurc",
  // 主流币与 LST
  "eth", "weth", "btc", "wbtc", "sol", "steth", "wsteth", "weeth", "reth",
  "ezeth", "rseth", "beth", "meth", "cbbtc", "tbtc",
  // RWA 大类词本身（命中等于把所有带 rwa 字样的池子都算进来）
  "rwa", "real", "world", "tokenized", "token", "tokens",
  // 治理代币
  "ondo", "mkr", "sky", "ena", "uni", "aave", "comp", "pol", "arb", "ldo", "rpl",
  "crv", "snx", "bal", "sushi", "cake", "velo", "aero", "joe", "spell", "fxs",
])

/**
 * 底层资产类别规则（按协议名 / slug 关键词推断）。
 *
 * DefiLlama 只给一个笼统的 RWA 分类，没有底层资产细分。这里是关键词推断，
 * **不是发行方官方披露**，页面必须在方法论里注明。顺序优先：先命中的规则生效。
 */
const ASSET_CLASS_RULES: ReadonlyArray<readonly [RegExp, RwaAssetClass]> = [
  [/treasury|tbill|t-bill|bill|sgov|bond|buidl|usyc|ousg|ustb|money[\s-]?market/i, "国债 / 货币市场"],
  [/credit|huma|credix|maple|goldfinch|centrifuge|invoice|receivable|re\b/i, "私人信贷"],
  [/gold|xau|paxg|xaut|silver/i, "贵金属"],
  [/real[\s-]?estate|realt|property|lofty|parcl|estate|tangible|brickken/i, "房地产"],
  [/equity|stock|tsla|nvda|spy|googl|aapl|msft|xstock|spx|ndx/i, "股票 / 股权"],
  [/carbon|energy|oil|gas|commodity|uranium/i, "大宗商品 / 碳信用"],
  [/fund|vault|vlt|clo/i, "基金份额"],
  // 以 RWA 资产（多为短债 / 货基）作储备的生息稳定币，如 USDtb、USD0、thUSD
  [/usd|usdt|eur|nara/i, "RWA 背书稳定币"],
]

/**
 * DefiLlama 链名 → Uniswap app 的 chain 参数。
 * 只有这些链能构造 swap 链接；其余（Sui、Pharos、Plume 等）回落到发行方官网。
 */
const UNISWAP_CHAINS: Readonly<Record<string, string>> = {
  ethereum: "ethereum",
  arbitrum: "arbitrum",
  base: "base",
  optimism: "optimism",
  polygon: "polygon",
  binance: "bsc",
  bsc: "bsc",
  avalanche: "avalanche",
  celo: "celo",
  blast: "blast",
  zora: "zora",
  unichain: "unichain",
  worldchain: "worldchain",
  "world chain": "worldchain",
  ink: "ink",
  monad: "monad",
  soneium: "soneium",
  gnosis: "gnosis",
  xdai: "gnosis",
  solana: "solana",
}

/**
 * 已公开接入 Uniswap v4 Permissioned Pools 的发行方。
 * 来源：Uniswap 官方发布（合作伙伴 Superstate / Securitize / Dowgo，Dowgo 走 ERC-3643）。
 * 仅用于标注，不代表该发行方的全部产品都已在该标准下可交易。
 */
const PERMISSIONED_ISSUERS: ReadonlyArray<readonly [string, string]> = [
  ["superstate", "Superstate"],
  ["securitize", "Securitize"],
  ["dowgo", "Dowgo"],
]

/** 协议 / 代币图标（DefiLlama icons，实测 184/184 个 RWA 协议均有） */
export function protocolLogoUrl(slug: string): string | null {
  if (!slug) return null
  return `https://icons.llamao.fi/icons/protocols/${slug}`
}

/** 链图标（实测 rsz_ 前缀可用；多词链名可能缺失，由调用方降级处理） */
export function chainLogoUrl(chain: string): string | null {
  if (!chain) return null
  return `https://icons.llamao.fi/icons/chains/rsz_${chain.toLowerCase().replace(/\s+/g, "-")}`
}

export function classifyAssetClass(name: string, slug: string): RwaAssetClass {
  const haystack = `${name} ${slug}`
  for (const [pattern, assetClass] of ASSET_CLASS_RULES) {
    if (pattern.test(haystack)) return assetClass
  }
  return "其他代币化资产"
}

/** 构造 Uniswap swap 链接；链不受支持或缺代币地址时返回 null */
export function buildUniswapSwapUrl(chain: string, tokenAddress: string | null): string | null {
  if (!tokenAddress) return null
  const chainSlug = UNISWAP_CHAINS[chain.toLowerCase()]
  if (!chainSlug) return null
  return `https://app.uniswap.org/swap?chain=${chainSlug}&inputCurrency=NATIVE&outputCurrency=${tokenAddress}`
}

/** 发行方是否已公开接入 Permissioned Pools */
function isPermissionedIssuer(name: string, slug: string, parent: string): boolean {
  const haystack = `${name} ${slug} ${parent}`.toLowerCase()
  return PERMISSIONED_ISSUERS.some(([key]) => haystack.includes(key))
}

/** 详情页最多保留多少个池子明细 */
const MAX_TOP_POOLS = 8

/** 池子 + 预切分的符号 token（由 client 在缓存前裁剪好，避免常驻内存里堆着全量字段） */
export type DexPoolEntry = { pool: LlamaPool; tokens: string[] }

export function isDexProject(project: string | undefined): boolean {
  return DEX_PROJECTS.has((project ?? "").toLowerCase())
}

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function toNullableNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * 从协议名与 slug 推导用于匹配 DEX 池的关键词（即该协议的产品符号）。
 * 例：BlackRock BUIDL / blackrock-buidl → [buidl, blackrock]
 */
function deriveKeywords(protocol: LlamaProtocol): string[] {
  const keywords = new Set<string>()

  // 协议名里的「大写开头词」通常是产品符号（BUIDL、USYC、RealT）
  for (const word of (protocol.name ?? "").split(/[^A-Za-z0-9]+/)) {
    if (word.length >= 3 && /^[A-Z]/.test(word)) keywords.add(word.toLowerCase())
  }

  // slug 分词补充产品名（buidl、usyc、thbill）
  for (const word of (protocol.slug ?? "").split(/[^a-z0-9]+/i)) {
    if (word.length >= 4) keywords.add(word.toLowerCase())
  }

  return [...keywords].filter(
    (word) => !STOP_WORDS.has(word) && !GENERIC_SYMBOLS.has(word) && word.length >= 3,
  )
}

/**
 * 池子符号 → 代币 token 列表。
 * "USDC-USDTB" → ["usdc", "usdtb"]；"WBTC-SOLVBTC-0.05%" → ["wbtc", "solvbtc", "0", "05"]
 */
export function toSymbolTokens(symbol: string): string[] {
  return symbol
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 0)
}

/**
 * 判断池子是否属于该协议的产品。
 *
 * 必须按「代币符号 token」比对，不能用子串包含：
 * 子串包含会让关键词 usd 命中 usdc / usdt 等一切稳定币池。
 *   - 关键词长度 >= 4：允许前缀匹配（solv → solvbtc）
 *   - 关键词长度 == 3：必须精确相等，避免短词误伤
 */
function poolMatches(poolTokens: string[], keywords: string[]): boolean {
  return poolTokens.some((token) =>
    keywords.some((keyword) =>
      keyword.length >= 4 ? token.startsWith(keyword) : token === keyword,
    ),
  )
}

function isRwaCategory(category: string | undefined): boolean {
  return (category ?? "").toLowerCase().includes("rwa")
}

/**
 * 从池子的底层代币里挑出「属于该协议产品」的那个地址，用于构造 DEX 跳转链接。
 * 池子是双边（如 USDC-USDtb），跳转发给用户时要指向资产那一侧，不能指向 USDC。
 */
function pickAssetToken(pool: LlamaPool, keywords: string[]): string | null {
  const tokens = pool.underlyingTokens
  if (!Array.isArray(tokens) || tokens.length === 0) return null
  if (keywords.length === 0) return tokens[0] ?? null

  const poolTokens = toSymbolTokens(pool.symbol ?? "")
  const index = poolTokens.findIndex((token) =>
    keywords.some((keyword) =>
      keyword.length >= 4 ? token.startsWith(keyword) : token === keyword,
    ),
  )
  // 符号 token 与底层地址通常同序；取不到就回落到第一个地址
  return (index >= 0 ? tokens[index] : undefined) ?? tokens[0] ?? null
}

/** 池子 → RWA 资产视图（只保留列表与统计所需字段，避免下发 11MB 全量） */
function toDexPool(pool: LlamaPool, keywords: string[]): RwaDexPool {
  const tokenAddress = pickAssetToken(pool, keywords)
  return {
    project: pool.project ?? "",
    symbol: pool.symbol ?? "",
    chain: pool.chain ?? "",
    tvlUsd: Math.round(toNumber(pool.tvlUsd)),
    apy: toNullableNumber(pool.apy),
    tokenAddress,
    swapUrl: buildUniswapSwapUrl(pool.chain ?? "", tokenAddress),
  }
}

/**
 * 主聚合：协议（一级市场）× DEX 池（二级市场）。
 */
export function aggregateRwa(
  protocols: LlamaProtocol[],
  dexPools: DexPoolEntry[],
): { assets: RwaAsset[]; totals: RwaTotals } {
  // 全局去重表：同一批池子常被多个金库协议共享（例如 Solv RWA / Solv Vesting 指向同一批池），
  // 资产维度保留各自的覆盖关系，但汇总维度必须按池去重，否则二级市场总量会被重复放大。
  const globalPools = new Map<string, number>()

  const assets: RwaAsset[] = protocols
    .filter((protocol) => isRwaCategory(protocol.category) && toNumber(protocol.tvl) > 0)
    .map((protocol) => {
      const keywords = deriveKeywords(protocol)
      const primaryTvlUsd = toNumber(protocol.tvl)

      // 遍历 DEX 池，按代币符号 token 匹配；匹配不到就如实为 0
      const matched: RwaDexPool[] = []
      const seen = new Set<string>()
      if (keywords.length > 0) {
        for (const { pool, tokens } of dexPools) {
          if (tokens.length === 0) continue
          const poolId = pool.pool ?? `${pool.project}-${pool.symbol}-${pool.chain}`
          if (seen.has(poolId)) continue
          if (poolMatches(tokens, keywords)) {
            seen.add(poolId)
            matched.push(toDexPool(pool, keywords))
            globalPools.set(poolId, Math.round(toNumber(pool.tvlUsd)))
          }
        }
      }

      const secondaryTvlUsd = matched.reduce((sum, pool) => sum + pool.tvlUsd, 0)

      const slug = protocol.slug ?? ""
      const name = protocol.name ?? slug
      const chains = Array.isArray(protocol.chains) ? protocol.chains : []
      const issuerUrl = protocol.url ?? null

      // 主行动按钮：有可跳转的 DEX 池就导向二级市场，否则导向发行方（一级市场申赎）
      const tradablePool = [...matched]
        .sort((a, b) => b.tvlUsd - a.tvlUsd)
        .find((pool) => pool.swapUrl !== null)

      return {
        id: slug,
        name,
        category: protocol.category ?? "",
        logoUrl: protocolLogoUrl(slug),
        issuerName: protocol.parent_protocol ?? name,
        issuerLogoUrl: protocolLogoUrl(slug),
        issuerUrl,
        assetClass: classifyAssetClass(name, slug),
        primaryTvlUsd: Math.round(primaryTvlUsd),
        secondaryTvlUsd: Math.round(secondaryTvlUsd),
        secondarySharePct:
          primaryTvlUsd > 0 ? Number(((secondaryTvlUsd / primaryTvlUsd) * 100).toFixed(4)) : 0,
        dexPoolCount: matched.length,
        chains,
        chainLogos: chains.map(chainLogoUrl),
        change1dPct: toNullableNumber(protocol.change_1d),
        change7dPct: toNullableNumber(protocol.change_7d),
        permissionedPoolIssuer: isPermissionedIssuer(name, slug, protocol.parent_protocol ?? ""),
        primaryActionUrl: tradablePool?.swapUrl ?? issuerUrl,
        primaryActionLabel: tradablePool?.swapUrl ? "在 Uniswap 交易" : issuerUrl ? "前往发行方" : null,
        topDexPools: [...matched]
          .sort((a, b) => b.tvlUsd - a.tvlUsd)
          .slice(0, MAX_TOP_POOLS),
      }
    })
    .filter((asset) => asset.id.length > 0)

  assets.sort((a, b) => b.primaryTvlUsd - a.primaryTvlUsd)

  const totalPrimary = assets.reduce((sum, asset) => sum + asset.primaryTvlUsd, 0)
  // 汇总走全局去重表，资产维度仍保留各自的 secondaryTvlUsd（覆盖关系）
  const totalSecondary = [...globalPools.values()].reduce((sum, tvl) => sum + tvl, 0)
  const dexPoolCount = globalPools.size
  const permissionedIssuerCount = assets.filter((asset) => asset.permissionedPoolIssuer).length

  return {
    assets,
    totals: {
      protocolCount: assets.length,
      primaryTvlUsd: Math.round(totalPrimary),
      secondaryTvlUsd: Math.round(totalSecondary),
      secondarySharePct:
        totalPrimary > 0 ? Number(((totalSecondary / totalPrimary) * 100).toFixed(4)) : 0,
      dexPoolCount,
      permissionedIssuerCount,
    },
  }
}

/** 关键词搜索（协议名 / slug / 链） */
export function filterRwaAssets(
  assets: RwaAsset[],
  options: { q?: string; chain?: string; minTvl?: number; onlyWithDex?: boolean },
): RwaAsset[] {
  const q = (options.q ?? "").trim().toLowerCase()
  const chain = (options.chain ?? "").trim().toLowerCase()
  const minTvl = options.minTvl ?? 0

  return assets.filter((asset) => {
    if (q && !`${asset.name} ${asset.id} ${asset.category}`.toLowerCase().includes(q)) {
      return false
    }
    if (chain && !asset.chains.some((item) => item.toLowerCase() === chain)) return false
    if (minTvl > 0 && asset.primaryTvlUsd < minTvl) return false
    if (options.onlyWithDex && asset.dexPoolCount === 0) return false
    return true
  })
}

export function sortRwaAssets(assets: RwaAsset[], sort: RwaSort): RwaAsset[] {
  const sorted = [...assets]
  switch (sort) {
    case "secondary-desc":
      return sorted.sort((a, b) => b.secondaryTvlUsd - a.secondaryTvlUsd)
    case "secondary-share-desc":
      return sorted.sort((a, b) => b.secondarySharePct - a.secondarySharePct)
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case "change1d-desc":
      return sorted.sort((a, b) => (b.change1dPct ?? -Infinity) - (a.change1dPct ?? -Infinity))
    case "primary-desc":
    default:
      return sorted.sort((a, b) => b.primaryTvlUsd - a.primaryTvlUsd)
  }
}

/** 列表页载荷瘦身：省略池子明细（详情页 / 接口按需返回） */
export function toListAsset(asset: RwaAsset): RwaAsset {
  return { ...asset, topDexPools: [] }
}

/** 美元金额格式化（紧凑） */
export function formatUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—"
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

/** 百分比格式化：极小值保留有效数字，避免一律显示 0.00% */
export function formatPct(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—"
  if (value >= 10) return `${value.toFixed(1)}%`
  if (value >= 1) return `${value.toFixed(2)}%`
  if (value >= 0.01) return `${value.toFixed(3)}%`
  return "<0.01%"
}
