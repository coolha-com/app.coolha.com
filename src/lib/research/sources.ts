/**
 * 投前侦察 —— 真实数据源客户端。
 *
 * 铁律：
 * 1. 只返回真实抓取到的数据。抓不到就返回 null，由 engine 判定为 unavailable。
 * 2. 绝不用随机数、模板或「看起来合理」的默认值填充任何指标。
 * 3. Alchemy 密钥只在服务端读取（process.env），永不传到浏览器。
 *
 * Alchemy 调用统一走 `@/lib/alchemy/client`（全站唯一实现），本文件只负责
 * 「把某个上游响应翻译成投前侦察需要的事实」。
 */

import "server-only"

import { alchemyRpc, hexToBigInt, isContractBytecode } from "@/lib/alchemy/client"

const DEFAULT_TIMEOUT_MS = 12_000

/** 本模块只查以太坊主网（投前侦察的历史口径，与工具层的多链口径不同） */
const RESEARCH_CHAIN = "ethereum" as const

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/**
 * Alchemy JSON-RPC（服务端专用）。
 *
 * 这里刻意吞掉异常并返回 null：投前侦察的契约是「取不到就返回 null → unavailable」，
 * 由 engine 决定怎么表达。错误分类（未配置 / 超时 / 限流 / 鉴权失败）是工具层
 * `/api/ai/tools/[slug]` 的需求，那边直接调用 `alchemyRpc` 拿 `AlchemyError`。
 */
async function alchemyRpcOrNull(method: string, params: unknown[]): Promise<string | null> {
  try {
    const result = await alchemyRpc(RESEARCH_CHAIN, method, params)
    return typeof result === "string" ? result : null
  } catch {
    return null
  }
}

/* ------------------------------- 合约事实 ------------------------------- */

export interface ContractFacts {
  /** 该地址是否为合约（有字节码） */
  isContract: boolean
  /** 运行时字节码字节数；拿不到为 null */
  bytecodeBytes: number | null
  /** Sourcify 是否验证开源；查不到为 null */
  verified: boolean | null
  verifiedAt: string | null
}

/**
 * 合约事实：Sourcify（免费公开，判是否验证开源）+ Alchemy eth_getCode（判是否合约）。
 * 两个源都拿不到时返回 null（视为 unavailable，不编造）。
 */
export async function fetchContractFacts(address: string): Promise<ContractFacts | null> {
  const lower = address.toLowerCase()

  const sourcify = await getJson<{
    match?: string
    creationMatch?: string
    runtimeMatch?: string
    verifiedAt?: string
  }>(`https://sourcify.dev/server/v2/contract/1/${lower}`)

  const code = await alchemyRpcOrNull("eth_getCode", [lower, "latest"])

  // Alchemy 未配置且 Sourcify 也没查到 → 无事实可报
  if (!code && !sourcify) return null

  const isContract = isContractBytecode(code)
  const bytecodeBytes =
    typeof code === "string" && code.startsWith("0x") ? (code.length - 2) / 2 : null

  const matchState = sourcify?.match ?? sourcify?.creationMatch ?? sourcify?.runtimeMatch
  const verified = matchState ? matchState === "match" || matchState === "partial_match" : null

  return {
    isContract,
    bytecodeBytes: bytecodeBytes === null ? null : Math.round(bytecodeBytes),
    verified,
    verifiedAt: sourcify?.verifiedAt ?? null,
  }
}

/* ------------------------------- 链上事实 ------------------------------- */

export interface OnchainFacts {
  /** ETH 余额；拿不到为 null */
  balanceEth: number | null
  /** 该地址发出的交易数（nonce）；拿不到为 null */
  txCount: number | null
}

/**
 * hex → 数值。
 *
 * ⚠️ 余额用 BigInt 而不是 `Number.parseInt`：wei 数量轻易超过 2^53
 * （1 ETH = 1e18 wei），用 Number 解析会静默丢精度。取整除的 nonce 用 BigInt 同样安全。
 */
function hexToNumber(hex: string | null): number | null {
  const wei = hexToBigInt(hex)
  if (wei === null) return null
  const n = Number(wei)
  return Number.isFinite(n) ? n : null
}

/** 链上事实：Alchemy 标准 JSON-RPC（余额 + nonce） */
export async function fetchOnchainFacts(address: string): Promise<OnchainFacts | null> {
  const lower = address.toLowerCase()
  const [balanceHex, txHex] = await Promise.all([
    alchemyRpcOrNull("eth_getBalance", [lower, "latest"]),
    alchemyRpcOrNull("eth_getTransactionCount", [lower, "latest"]),
  ])

  if (balanceHex === null && txHex === null) return null

  const wei = hexToBigInt(balanceHex)
  return {
    balanceEth: wei === null ? null : Number(wei) / 1e18,
    txCount: hexToNumber(txHex),
  }
}

/* ------------------------------- 代币事实 ------------------------------- */

export interface TokenFacts {
  symbol: string | null
  priceUsd: number | null
  /** 协议 TVL（仅当目标是 DefiLlama 收录的协议时才有） */
  protocolTvl: number | null
  protocolName: string | null
}

/**
 * 代币事实：DefiLlama 公开 API（免费、无需 key）。
 * - 目标是 0x 地址 → 查 coins 价格
 * - 目标是名称/符号 → 查协议 TVL
 */
export async function fetchTokenFacts(
  target: string,
  targetType: "contract" | "token" | "project",
): Promise<TokenFacts | null> {
  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(target.trim())

  if (isAddress) {
    const res = await getJson<{
      coins?: Record<string, { symbol?: string; price?: number }>
    }>(`https://coins.llama.fi/prices/current/ethereum:${target.trim().toLowerCase()}`)
    const coin = res?.coins ? Object.values(res.coins)[0] : undefined
    if (!coin) return null
    return {
      symbol: coin.symbol ?? null,
      priceUsd: typeof coin.price === "number" ? coin.price : null,
      protocolTvl: null,
      protocolName: null,
    }
  }

  // 非地址：按 DefiLlama 协议 slug 查 TVL
  if (targetType === "project") {
    const slug = target
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    const res = await getJson<{
      name?: string
      // DefiLlama 的 tvl 是历史序列（按天），不是单个数字
      tvl?: Array<{ date?: number; totalLiquidityUSD?: number }>
    }>(`https://api.llama.fi/protocol/${slug}`)
    if (!res) return null

    // 取序列最后一个点作为「当前 TVL」
    const series = Array.isArray(res.tvl) ? res.tvl : []
    const last = series.at(-1)
    const protocolTvl =
      typeof last?.totalLiquidityUSD === "number" ? last.totalLiquidityUSD : null

    return {
      symbol: null,
      priceUsd: null,
      protocolTvl,
      protocolName: res.name ?? null,
    }
  }

  return null
}
