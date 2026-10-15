import "server-only"

import { createPublicClient, http, type Chain } from "viem"
import { base, mainnet } from "viem/chains"

import { SUBSCRIPTION_CHAINS, type ChainKey, type TokenSymbol } from "./config"
import { getTreasuryAddress, settleWithTransfer, type ObservedTransfer } from "@/lib/neon/subscription"

/**
 * 链上转账扫描（订单匹配法的执行端）。
 *
 * 用 viem 直连 Alchemy RPC 拉 ERC-20 Transfer 日志（to == 收款地址），
 * 逐条交给 settleWithTransfer 结算。幂等由 tx_hash + log_index 唯一索引保证，
 * 因此重复扫描、webhook 与 cron 并发都不会重复授予。
 */

const TRANSFER_EVENT = {
  type: "event",
  name: "Transfer",
  inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false },
  ],
} as const

const CHAIN_OBJECTS: Record<ChainKey, Chain> = {
  base,
  ethereum: mainnet,
}

export function alchemyRpcUrl(chain: ChainKey): string | null {
  const key = process.env.ALCHEMY_KEY ?? process.env.ALCHEMY_ID ?? ""
  if (!key) return null
  const config = SUBSCRIPTION_CHAINS[chain]
  return `https://${config.rpcSubdomain}.g.alchemy.com/v2/${key}`
}

export interface ScanOptions {
  /** 自定义回溯区块数（默认用链配置的 ≈30 分钟） */
  blocks?: number
}

/** 扫描最近区块内打到收款地址的稳定币转账 */
export async function scanTransfers(
  chain: ChainKey,
  token: TokenSymbol,
  options: ScanOptions = {},
): Promise<ObservedTransfer[]> {
  const treasury = getTreasuryAddress()
  const rpcUrl = alchemyRpcUrl(chain)
  if (!treasury || !rpcUrl) return []

  const config = SUBSCRIPTION_CHAINS[chain]
  const tokenConfig = config.tokens[token]
  const client = createPublicClient({
    chain: CHAIN_OBJECTS[chain],
    transport: http(rpcUrl),
  })

  try {
    const latest = await client.getBlockNumber()
    const confirmed = latest - BigInt(config.confirmations)
    const span = BigInt(options.blocks ?? config.scanBlocks)
    const fromBlock = confirmed > span ? confirmed - span : 0n
    if (confirmed <= 0n) return []

    const logs = await client.getLogs({
      address: tokenConfig.address,
      event: TRANSFER_EVENT,
      args: { to: treasury.toLowerCase() as `0x${string}` },
      fromBlock,
      toBlock: confirmed,
    })

    return logs.map((log) => ({
      chain,
      token,
      from: String(log.args.from ?? ""),
      raw: BigInt(log.args.value ?? 0n),
      txHash: String(log.transactionHash ?? ""),
      logIndex: Number(log.logIndex ?? 0),
    }))
  } catch (error) {
    console.error(`[subscription] 扫描 ${chain}/${token} 失败:`, error)
    return []
  }
}

export interface SyncResult {
  scanned: number
  granted: number
}

/** 扫一对 (chain, token) 并逐条结算 */
export async function syncChainToken(
  chain: ChainKey,
  token: TokenSymbol,
  options: ScanOptions = {},
): Promise<SyncResult> {
  const transfers = await scanTransfers(chain, token, options)
  let granted = 0
  for (const transfer of transfers) {
    if (!transfer.from || !transfer.txHash || transfer.raw <= 0n) continue
    const result = await settleWithTransfer(transfer)
    if (result.status === "granted") granted += 1
  }
  return { scanned: transfers.length, granted }
}

/** 扫全部 (chain, token) 组合，供 cron 使用 */
export async function syncAll(): Promise<SyncResult & { skipped: boolean }> {
  if (!getTreasuryAddress() || !alchemyRpcUrl("base")) {
    return { scanned: 0, granted: 0, skipped: true }
  }
  let scanned = 0
  let granted = 0
  for (const chain of Object.keys(SUBSCRIPTION_CHAINS) as ChainKey[]) {
    for (const token of Object.keys(SUBSCRIPTION_CHAINS[chain].tokens) as TokenSymbol[]) {
      const result = await syncChainToken(chain, token)
      scanned += result.scanned
      granted += result.granted
    }
  }
  return { scanned, granted, skipped: false }
}
