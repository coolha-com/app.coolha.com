import "server-only"

import { SUBSCRIPTION_CHAINS, type ChainKey } from "@/lib/subscription/config"

/**
 * Web3 工具层的服务端 Alchemy 读链客户端。
 *
 * 铁律（与项目既有纪律一致）：
 * 1. **密钥只在服务端读**（`process.env`），永不进入浏览器响应、永不写进任何文件。
 * 2. **只返回真实抓到的数据**。抓不到就报错，不回退为 0 / 假值 / 示例数据。
 * 3. **只读**。本模块只调用 `eth_blockNumber` / `eth_getBlockByNumber` /
 *    `eth_getBalance` / `eth_getTransactionCount`，不构造、不广播任何交易。
 * 4. 链配置复用订阅模块的同一份登记（Base + Ethereum），避免两处维护 RPC 子域。
 */

const RPC_TIMEOUT_MS = 12_000

/** 本工具层开放的链：与订阅扫链同一套登记 */
export const TOOL_CHAIN_KEYS = Object.keys(SUBSCRIPTION_CHAINS) as ChainKey[]

/**
 * 读取服务端 Alchemy 凭证。
 *
 * 约定与既有代码一致：`ALCHEMY_KEY` 优先，`ALCHEMY_ID` 兜底（见
 * `docs/WEB3_TOOL_REGISTRY_PHASE1_PLAN.md` §1 的「已有 Alchemy 凭证读取约定」）。
 * 空串按「未配置」处理，避免一个空变量把另一个有效值挡掉。
 *
 * ⚠️ 返回值只在本模块内部用于拼 URL，**绝不回传、绝不写进任何文件或日志**。
 */
function readAlchemyKey(): string {
  for (const candidate of [process.env.ALCHEMY_KEY, process.env.ALCHEMY_ID]) {
    const value = candidate?.trim()
    if (value) return value
  }
  return ""
}

/** 服务端是否配置了 Alchemy key —— 只判断存在性，绝不读取或回传值 */
export function isAlchemyConfigured(): boolean {
  return readAlchemyKey().length > 0
}

export function isToolChain(value: unknown): value is ChainKey {
  return typeof value === "string" && value in SUBSCRIPTION_CHAINS
}

/** 对外暴露的端点标识：只有子域，不含密钥 */
export function alchemyEndpointLabel(chain: ChainKey): string {
  return `${SUBSCRIPTION_CHAINS[chain].rpcSubdomain}.g.alchemy.com`
}

/** key 未配置 —— 与「上游报错」区分开，UI 要如实说「未配置」而不是「查不到」 */
export class AlchemyNotConfiguredError extends Error {
  constructor() {
    super("ALCHEMY_KEY 未配置")
    this.name = "AlchemyNotConfiguredError"
  }
}

/** 上游不可用（网络、鉴权、限流） */
export class AlchemyUpstreamError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = "AlchemyUpstreamError"
  }
}

async function rpc(chain: ChainKey, method: string, params: unknown[]): Promise<unknown> {
  const key = readAlchemyKey()
  if (!key) throw new AlchemyNotConfiguredError()

  const url = `https://${SUBSCRIPTION_CHAINS[chain].rpcSubdomain}.g.alchemy.com/v2/${key}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  })

  if (!res.ok) throw new AlchemyUpstreamError(`HTTP ${res.status}`)

  const json = (await res.json()) as { result?: unknown; error?: { message?: string } }
  if (json.error) throw new AlchemyUpstreamError(json.error.message ?? "upstream error")
  return json.result
}

function hexToBigInt(value: unknown): bigint | null {
  if (typeof value !== "string" || !value.startsWith("0x")) return null
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

export interface ToolChainSnapshot {
  chain: ChainKey
  chainId: number
  label: string
  /** 最新区块高度 */
  blockNumber: number
  /** 最新区块时间（ISO）；取不到为 null */
  blockTime: string | null
  /** 被查询的地址；未提供地址时为 null */
  address: string | null
  /** 原生币余额（ETH）；未提供地址或取不到为 null */
  balanceEth: number | null
  /** 余额原始 wei（字符串，避免精度丢失） */
  balanceWei: string | null
  /** 该地址发出的交易数（nonce）；未提供地址或取不到为 null */
  txCount: number | null
}

/**
 * 读一次链上状态。
 *
 * @param chain Base / Ethereum
 * @param address 可选。给了就一并查余额与 nonce；不给只查区块高度与时间。
 */
export async function fetchChainSnapshot(
  chain: ChainKey,
  address?: string | null,
): Promise<ToolChainSnapshot> {
  const config = SUBSCRIPTION_CHAINS[chain]
  const target = address ? address.toLowerCase() : null

  const blockHex = await rpc(chain, "eth_blockNumber", [])
  const blockNumber = hexToBigInt(blockHex)
  if (blockNumber === null) throw new AlchemyUpstreamError("eth_blockNumber 返回了非法值")

  // 区块时间单独取：失败不影响主结果，置 null 并在 unknown 里如实标注
  let blockTime: string | null = null
  try {
    const block = (await rpc(chain, "eth_getBlockByNumber", ["latest", false])) as {
      timestamp?: string
    } | null
    const ts = hexToBigInt(block?.timestamp)
    if (ts !== null) blockTime = new Date(Number(ts) * 1000).toISOString()
  } catch {
    blockTime = null
  }

  let balanceEth: number | null = null
  let balanceWei: string | null = null
  let txCount: number | null = null

  if (target) {
    const [balanceHex, nonceHex] = await Promise.all([
      rpc(chain, "eth_getBalance", [target, "latest"]),
      rpc(chain, "eth_getTransactionCount", [target, "latest"]),
    ])
    const wei = hexToBigInt(balanceHex)
    if (wei !== null) {
      balanceWei = wei.toString()
      balanceEth = Number(wei) / 1e18
    }
    const nonce = hexToBigInt(nonceHex)
    if (nonce !== null) txCount = Number(nonce)
  }

  return {
    chain,
    chainId: config.id,
    label: config.label,
    blockNumber: Number(blockNumber),
    blockTime,
    address: target,
    balanceEth,
    balanceWei,
    txCount,
  }
}
