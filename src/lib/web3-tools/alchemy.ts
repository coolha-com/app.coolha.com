import "server-only"

import {
  alchemyEndpointLabel,
  alchemyRpc,
  hexToBigInt,
  isAlchemyConfigured,
} from "@/lib/alchemy/client"
import { SUBSCRIPTION_CHAINS, type ChainKey } from "@/lib/subscription/config"
import {
  trace,
  type ToolCoverage,
  type ToolResult,
  type ToolSource,
} from "@/lib/web3-tools/evidence"

/**
 * Web3 工具层的服务端 Alchemy 读链客户端。
 *
 * 铁律：
 * 1. **密钥只在服务端读**（`process.env`），永不进入浏览器响应、永不写进任何文件。
 * 2. **只返回真实抓到的数据**。抓不到就报错/置 null，不回退为 0 / 假值 / 示例数据。
 * 3. **只读**。本模块只调用 `eth_blockNumber` / `eth_getBlockByNumber` /
 *    `eth_getBalance` / `eth_getTransactionCount`，不构造、不广播任何交易。
 * 4. **不生成评分或概率**。这里只有上游返回的原始事实，没有推断出来的分数。
 * 5. RPC 调用统一走 `@/lib/alchemy/client`（全站唯一实现），本文件只做
 *    「把上游响应翻译成工具层的数据结构 + 装进证据信封」。
 */

/** 本工具层开放的链：与订阅扫链同一套登记 */
export const TOOL_CHAIN_KEYS = Object.keys(SUBSCRIPTION_CHAINS) as ChainKey[]

export function isToolChain(value: unknown): value is ChainKey {
  return typeof value === "string" && value in SUBSCRIPTION_CHAINS
}

/** 服务端是否配置了 Alchemy key —— 只判断存在性，绝不读取或回传值 */
export { isAlchemyConfigured }

/** 端点标识：只有子域，不含密钥 */
export { alchemyEndpointLabel }

/** 单次查询实际用到的 RPC 方法（用于证据信封的 source.method） */
export type AlchemyToolMethod = "block" | "address"

/** 读链结果。字段语义与覆盖边界见 ToolResult。 */
export interface ToolChainData {
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

export interface ToolChainQuery {
  chain: ChainKey
  /** 可选。给了就一并查余额与 nonce；不给只查区块高度与时间。 */
  address?: string | null
}

/**
 * 读一次链上状态，返回**证据信封**。
 *
 * 取不到的项一律进 `unknown`，绝不填占位数值。
 */
export async function fetchChainSnapshot(query: ToolChainQuery): Promise<ToolResult<ToolChainData>> {
  const { chain } = query
  const config = SUBSCRIPTION_CHAINS[chain]
  const address = query.address ? query.address.toLowerCase() : null

  const method =
    address === null
      ? "eth_blockNumber / eth_getBlockByNumber"
      : "eth_blockNumber / eth_getBlockByNumber / eth_getBalance / eth_getTransactionCount"

  const source: Omit<ToolSource, "fetchedAt" | "latencyMs"> = {
    provider: "alchemy-rpc",
    method,
    endpoint: alchemyEndpointLabel(chain),
    chain,
    chainId: config.id,
  }

  return trace<ToolChainData>({
    tool: "alchemy-mcp-server",
    source,
    fn: async () => {
      const warnings: string[] = []
      const unknown: string[] = []

      const blockHex = await alchemyRpc(chain, "eth_blockNumber", [])
      const blockNumber = hexToBigInt(blockHex)
      if (blockNumber === null) {
        throw new Error("eth_blockNumber 返回了非法值")
      }

      // 区块时间单独取：失败不影响主结果，置 null 并在 unknown 里如实标注
      let blockTime: string | null = null
      try {
        const block = (await alchemyRpc(chain, "eth_getBlockByNumber", ["latest", false])) as {
          timestamp?: string
        } | null
        const ts = hexToBigInt(block?.timestamp)
        if (ts !== null) blockTime = new Date(Number(ts) * 1000).toISOString()
        else unknown.push("最新区块时间戳未取到")
      } catch {
        blockTime = null
        unknown.push("最新区块时间戳未取到")
      }

      let balanceEth: number | null = null
      let balanceWei: string | null = null
      let txCount: number | null = null

      if (address !== null) {
        // 余额与 nonce 各自独立取：其中一个失败不影响另一个
        try {
          const balanceHex = await alchemyRpc(chain, "eth_getBalance", [address, "latest"])
          const wei = hexToBigInt(balanceHex)
          if (wei === null) unknown.push("原生币余额未取到")
          else {
            balanceWei = wei.toString()
            balanceEth = Number(wei) / 1e18
          }
        } catch {
          unknown.push("原生币余额未取到")
        }

        try {
          const nonceHex = await alchemyRpc(chain, "eth_getTransactionCount", [address, "latest"])
          const nonce = hexToBigInt(nonceHex)
          if (nonce === null) unknown.push("交易计数（nonce）未取到")
          else txCount = Number(nonce)
        } catch {
          unknown.push("交易计数（nonce）未取到")
        }
      } else {
        // 未提供地址：明确说明这两项没查，而不是让字段留空让人误以为没数据
        unknown.push("未提供地址：本次未查询原生币余额与交易计数")
      }

      const coverage: ToolCoverage = {
        fromBlock: Number(blockNumber),
        toBlock: Number(blockNumber),
        requestedWindow: "latest block（仅最新一个区块）",
        truncated: false,
        returnedItems: address === null ? 2 : 4,
        note:
          address === null
            ? "只覆盖最新区块的高度与时间；未查询任何地址的链上数据"
            : "只覆盖该地址在 latest 区块的原生币余额与 nonce；未查询历史区块、代币持仓、转账记录与合约源码",
      }

      // 上游口径提醒：latest 是未确认状态
      warnings.push("区块与余额取自 latest（尚未最终确认的区块），可能随后被重组")

      return {
        data: {
          chain,
          chainId: config.id,
          label: config.label,
          blockNumber: Number(blockNumber),
          blockTime,
          address,
          balanceEth,
          balanceWei,
          txCount,
        },
        warnings,
        unknown,
        coverage,
      }
    },
  })
}
