import "server-only"

import {
  alchemyEndpointLabel,
  alchemyRpc,
  hexToBigInt,
  isContractBytecode,
} from "@/lib/alchemy/client"
import { chainByKey, isConnectedChain } from "@/lib/chains/registry"
import {
  addressFromSlot,
  balanceOfData,
  decodeAbiString,
  decodeUint,
  EIP1967_IMPLEMENTATION_SLOT,
  ERC20,
  formatShare,
  formatUnits,
  isAddress,
} from "@/lib/rwa/abi"
import type { TokenObservation } from "@/lib/rwa/report"

export class ChainNotConnectedError extends Error {
  readonly code = "NOT_CONNECTED"
  constructor(message: string) {
    super(message)
    this.name = "ChainNotConnectedError"
  }
}

async function callOrNull(chain: string, method: string, params: unknown[]): Promise<unknown | null> {
  try {
    return await alchemyRpc(chain, method, params)
  } catch {
    return null
  }
}

export async function readTokenObservation(input: {
  chainKey: string
  address: string
  holder?: string | null
}): Promise<TokenObservation> {
  const entry = chainByKey(input.chainKey)
  if (!entry || !isConnectedChain(input.chainKey)) {
    throw new ChainNotConnectedError(
      entry ? `${entry.label} 未接入，本次没有发起 RPC` : "未知链，本次没有发起 RPC",
    )
  }
  if (!isAddress(input.address)) {
    throw new ChainNotConnectedError("address 必须是 0x 地址")
  }
  const holder = input.holder?.trim() ? input.holder.trim() : null
  if (holder && !isAddress(holder)) {
    throw new ChainNotConnectedError("holder 必须是 0x 地址")
  }

  const address = input.address
  const unknown: string[] = []
  const fetchedAt = new Date().toISOString()

  const blockHex = await alchemyRpc(entry.key, "eth_blockNumber", [])
  const blockNumberRaw = hexToBigInt(blockHex)
  const blockNumber = blockNumberRaw === null ? null : Number(blockNumberRaw)
  if (blockNumber === null) unknown.push("最新区块高度未取到")

  const [block, code, nameHex, symbolHex, decimalsHex, supplyHex, slotHex, balanceHex] =
    await Promise.all([
      callOrNull(entry.key, "eth_getBlockByNumber", ["latest", false]),
      callOrNull(entry.key, "eth_getCode", [address, "latest"]),
      callOrNull(entry.key, "eth_call", [{ to: address, data: ERC20.name }, "latest"]),
      callOrNull(entry.key, "eth_call", [{ to: address, data: ERC20.symbol }, "latest"]),
      callOrNull(entry.key, "eth_call", [{ to: address, data: ERC20.decimals }, "latest"]),
      callOrNull(entry.key, "eth_call", [{ to: address, data: ERC20.totalSupply }, "latest"]),
      callOrNull(entry.key, "eth_getStorageAt", [address, EIP1967_IMPLEMENTATION_SLOT, "latest"]),
      holder
        ? callOrNull(entry.key, "eth_call", [{ to: address, data: balanceOfData(holder) }, "latest"])
        : Promise.resolve(null),
    ])

  let blockTime: string | null = null
  const timestamp = hexToBigInt((block as { timestamp?: string } | null)?.timestamp)
  if (timestamp === null) unknown.push("最新区块时间未取到")
  else blockTime = new Date(Number(timestamp) * 1000).toISOString()

  const isContract = code === null ? null : isContractBytecode(code)
  if (isContract === null) unknown.push("运行时代码未取到")
  if (isContract === false) unknown.push("该地址没有合约代码")

  const name = decodeAbiString(nameHex)
  const symbol = decodeAbiString(symbolHex)
  const decimalsRaw = decodeUint(decimalsHex)
  const decimals =
    decimalsRaw !== null && decimalsRaw >= 0n && decimalsRaw <= 255n ? Number(decimalsRaw) : null
  const supply = decodeUint(supplyHex)
  const balance = holder ? decodeUint(balanceHex) : null

  if (!name) unknown.push("name 未取到")
  if (!symbol) unknown.push("symbol 未取到")
  if (decimals === null) unknown.push("decimals 未取到")
  if (supply === null) unknown.push("totalSupply 未取到")
  if (holder && balance === null) unknown.push("指定地址余额未取到")
  if (!holder) unknown.push("未提供地址：未计算单个持有占比")

  const implementationHint = addressFromSlot(slotHex)

  return {
    chainKey: entry.key,
    chainLabel: entry.label,
    chainId: entry.chainId,
    endpoint: alchemyEndpointLabel(entry.key),
    address,
    isContract,
    name,
    symbol,
    decimals,
    totalSupplyRaw: supply?.toString() ?? null,
    totalSupplyDisplay:
      supply !== null && decimals !== null ? formatUnits(supply, decimals) : supply?.toString() ?? null,
    holderAddress: holder,
    holderBalanceRaw: balance?.toString() ?? null,
    holderBalanceDisplay:
      balance !== null && decimals !== null ? formatUnits(balance, decimals) : balance?.toString() ?? null,
    holderShare: balance !== null && supply !== null ? formatShare(balance, supply) : null,
    implementationHint,
    blockNumber,
    blockTime,
    unknown,
    fetchedAt,
  }
}
