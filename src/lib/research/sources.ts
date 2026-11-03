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
 * 取数结果的三态 —— **「没查到」与「查了没有」必须分开**。
 *
 * 事故背景：Sourcify 对「该地址无验证记录」返回 HTTP 404，而网络故障/超时也被
 * 归成 null → 两者同值 → engine 把「服务挂了」说成「这个合约没有验证记录」。
 * 前者是**确定结论**，后者是**未知**，不能混。
 */
type FetchOutcome<T> =
  /** 取到了（含「上游明确说没有」这种确定结论） */
  | { kind: "ok"; value: T }
  /** 上游明确回答「无此记录」（HTTP 404）—— 确定结论 */
  | { kind: "not-found" }
  /** 取数失败（网络故障/超时/限流/非 404 的错误状态）—— 未知 */
  | { kind: "failed"; reason: string }

/**
 * 区分 404（上游确认无记录）与取数失败。
 *
 * ⚠️ 只有 404 才是「确定无记录」；5xx / 超时 / 网络错误都是「不知道」。
 */
async function fetchWithOutcome<T>(url: string): Promise<FetchOutcome<T>> {
  let res: Response
  try {
    res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : "网络错误"
    return { kind: "failed", reason }
  }

  if (res.status === 404) return { kind: "not-found" }
  if (!res.ok) return { kind: "failed", reason: `HTTP ${res.status}` }

  try {
    return { kind: "ok", value: (await res.json()) as T }
  } catch (error) {
    return { kind: "failed", reason: error instanceof Error ? error.message : "响应解析失败" }
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

/**
 * 源码验证状态 —— **四态**，缺一不可。
 *
 * | 值 | 含义 | 可否定级 |
 * | --- | --- | --- |
 * | `true` | 验证通过（源码与链上字节码一致） | 可给 low |
 * | `false` | **有记录但不匹配** —— 唯一明确的负面事实 | 可给 high |
 * | `"not-found"` | Sourcify 确认无此合约的验证记录（HTTP 404） | **不得**定级为异常 → null |
 * | `null` | **取数失败**（网络故障/超时/限流）或未知取值 | **不得**定级为异常 → null |
 *
 * ⚠️ `"not-found"` 与 `null` 都**不是**负面事实。「查不到」≠「查了没有」。
 */
export type VerifiedState = true | false | "not-found" | null

/**
 * Sourcify `match` 取值 → 验证状态。
 *
 * ⛔ **必须是查表 + 未知兜底，禁止 if/else 链。**
 *
 * 事故背景：旧代码写成 `matchState === "match" || matchState === "partial_match"`，
 * 结果 v2 的 `'exact_match'`（**验证最严格**）落到 false → 被判成「未验证」+
 * 「不要转入主资金」。**方向完全反了的错误负面判断。**
 *
 * ⛔ **未知取值一律保守兜底为 null（未知），绝不默认当成 false。**
 * 默认成 false 就是本次事故本身 —— Sourcify 下一个新取值会原样重演。
 *
 * 📌 枚举依据（Sourcify v2 OpenAPI `server/v2/openapi.json` 实测提取）：
 * `match` / `creationMatch` / `runtimeMatch` 的 enum **只有**
 * `["match", "exact_match", null]` 三值。
 * 官方对二者的区分：`exact_match` 表示源码与链上**运行时**字节码逐字节一致，
 * `match` 表示通过校验但（可能）有 immutable/构造参数等差异 —— 两者都是**验证通过**。
 *
 * ⚠️ `'partial_match'` 不在 v2 枚举内（v1 的布尔模型遗留）。保留映射以防
 * 上游将来引入该取值，语义按「部分验证通过」处理 —— 既不算完全通过，
 * 也不算「明确不匹配」，归入未知兜底更安全，故此处**不列入**。
 */
const VERIFIED_FROM_MATCH: Record<string, VerifiedState> = {
  // 验证通过（v2 两种通过态）
  match: true,
  exact_match: true,
}

/**
 * 把 Sourcify 的 match 字段翻译成四态验证状态。
 *
 * @param matchState 上游返回的 match / creationMatch / runtimeMatch 值
 * @param hasRecord  上游是否有该合约的验证记录（HTTP 200 且带记录）
 */
function resolveVerified(matchState: string | null | undefined, hasRecord: boolean): VerifiedState {
  // 无任何 match 值 —— 上游确认无记录（404）或该合约未进入验证体系
  if (matchState === null || matchState === undefined) {
    return hasRecord ? null : "not-found"
  }

  // 查表命中
  const mapped = VERIFIED_FROM_MATCH[matchState]
  if (mapped !== undefined) return mapped

  // ⛔ 未知取值 → 保守兜底为「未知」，**不得**当成 false（不匹配）
  return null
}

export interface ContractFacts {
  /** 该地址是否为合约（有字节码） */
  isContract: boolean
  /** 运行时字节码字节数；拿不到为 null */
  bytecodeBytes: number | null
  /** 源码验证状态（四态）；见 VerifiedState */
  verified: VerifiedState
  /** 验证时间；拿不到为 null */
  verifiedAt: string | null
}

/**
 * 合约事实：Sourcify（免费公开，判是否验证开源）+ Alchemy eth_getCode（判是否合约）。
 *
 * ⚠️ 三个源的可得性必须**分别**表达，不能压成一个 null：
 * - Sourcify 404 → 「确认无验证记录」（确定结论）
 * - Sourcify 故障 → 「未知」（取数失败）
 * - Alchemy 故障 → 「未知」
 */
export async function fetchContractFacts(address: string): Promise<ContractFacts | null> {
  const lower = address.toLowerCase()

  const sourcifyOutcome = await fetchWithOutcome<{
    match?: string | null
    creationMatch?: string | null
    runtimeMatch?: string | null
    verifiedAt?: string
  }>(`https://sourcify.dev/server/v2/contract/1/${lower}`)

  const code = await alchemyRpcOrNull("eth_getCode", [lower, "latest"])

  const sourcify = sourcifyOutcome.kind === "ok" ? sourcifyOutcome.value : null

  // Alchemy 未配置/失败，且 Sourcify 也确认无记录 → 完全无事实可报
  if (!code && sourcifyOutcome.kind !== "ok") return null

  const isContract = isContractBytecode(code)
  const bytecodeBytes =
    typeof code === "string" && code.startsWith("0x") ? (code.length - 2) / 2 : null

  const matchState = sourcify?.match ?? sourcify?.creationMatch ?? sourcify?.runtimeMatch
  // 有记录 = 上游 HTTP 200 且给了 verifiedAt；404 时确定是「无记录」
  const hasRecord = sourcifyOutcome.kind === "ok" && Boolean(sourcify?.verifiedAt)
  const verified = resolveVerified(matchState, hasRecord)

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
