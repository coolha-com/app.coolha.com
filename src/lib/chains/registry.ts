/**
 * RWA Agent 的链登记。
 *
 * priority 是接入顺序，不是投资排名，也不引用外部规模数字。
 * access=reserved 的链只出现在登记里，调用方不得对它们发起 RPC。
 * 订阅扫链仍使用 src/lib/subscription/config.ts，不从这里改收款网络。
 */

export type ChainAccess = "connected" | "reserved"

export interface ChainRegistryEntry {
  key: string
  chainId: number
  label: string
  /** Alchemy 子域。未接入时为 null，禁止拿它拼 URL。 */
  alchemySubdomain: string | null
  access: ChainAccess
  /** 接入顺序，越小越先。不是排序或推荐。 */
  priority: number
  batch: 1 | 2
}

export const CHAIN_REGISTRY: readonly ChainRegistryEntry[] = [
  {
    key: "ethereum",
    chainId: 1,
    label: "Ethereum",
    alchemySubdomain: "eth-mainnet",
    access: "connected",
    priority: 1,
    batch: 1,
  },
  {
    key: "bnb",
    chainId: 56,
    label: "BNB Chain",
    alchemySubdomain: "bnb-mainnet",
    access: "connected",
    priority: 2,
    batch: 1,
  },
  {
    key: "avalanche",
    chainId: 43114,
    label: "Avalanche",
    alchemySubdomain: "avax-mainnet",
    access: "connected",
    priority: 3,
    batch: 1,
  },
  {
    key: "arbitrum",
    chainId: 42161,
    label: "Arbitrum",
    alchemySubdomain: "arb-mainnet",
    access: "connected",
    priority: 4,
    batch: 1,
  },
  {
    key: "zksync",
    chainId: 324,
    label: "ZKsync Era",
    alchemySubdomain: null,
    access: "reserved",
    priority: 5,
    batch: 2,
  },
  {
    key: "base",
    chainId: 8453,
    label: "Base",
    alchemySubdomain: null,
    access: "reserved",
    priority: 6,
    batch: 2,
  },
  {
    key: "polygon",
    chainId: 137,
    label: "Polygon",
    alchemySubdomain: null,
    access: "reserved",
    priority: 7,
    batch: 2,
  },
]

const BY_KEY = new Map(CHAIN_REGISTRY.map((entry) => [entry.key, entry]))

export function chainByKey(key: string): ChainRegistryEntry | null {
  return BY_KEY.get(key) ?? null
}

export function isConnectedChain(key: string): boolean {
  return chainByKey(key)?.access === "connected"
}

export function connectedChains(): ChainRegistryEntry[] {
  return CHAIN_REGISTRY.filter((entry) => entry.access === "connected")
}

export function reservedChains(): ChainRegistryEntry[] {
  return CHAIN_REGISTRY.filter((entry) => entry.access === "reserved")
}
