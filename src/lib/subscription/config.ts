/**
 * 链上订阅的链与稳定币配置（同构：客户端与服务端共用）。
 * 不含任何密钥——收款地址与 RPC Key 由服务端从环境变量读取。
 *
 * 计价以 USD 为准，支付时折算为稳定币数量（稳定币 ≈ 1:1）。
 */

export type ChainKey = "base" | "ethereum"
export type TokenSymbol = "USDC" | "USDT"

export interface StablecoinConfig {
  symbol: TokenSymbol
  address: `0x${string}`
  decimals: number
}

export interface ChainConfig {
  key: ChainKey
  /** EVM chain id */
  id: number
  label: string
  /** Alchemy RPC 子域名前缀 */
  rpcSubdomain: string
  /** 入账所需确认数 */
  confirmations: number
  /** 单次同步回溯的区块数（≈30 分钟） */
  scanBlocks: number
  tokens: Record<TokenSymbol, StablecoinConfig>
}

export const SUBSCRIPTION_CHAINS: Record<ChainKey, ChainConfig> = {
  base: {
    key: "base",
    id: 8453,
    label: "Base",
    rpcSubdomain: "base-mainnet",
    confirmations: 3,
    scanBlocks: 900,
    tokens: {
      USDC: {
        symbol: "USDC",
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6,
      },
      USDT: {
        symbol: "USDT",
        address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
        decimals: 6,
      },
    },
  },
  ethereum: {
    key: "ethereum",
    id: 1,
    label: "Ethereum",
    rpcSubdomain: "eth-mainnet",
    confirmations: 6,
    scanBlocks: 150,
    tokens: {
      USDC: {
        symbol: "USDC",
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        decimals: 6,
      },
      USDT: {
        symbol: "USDT",
        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        decimals: 6,
      },
    },
  },
}

export const SUBSCRIPTION_CHAIN_KEYS = Object.keys(SUBSCRIPTION_CHAINS) as ChainKey[]
export const SUBSCRIPTION_TOKENS: TokenSymbol[] = ["USDC", "USDT"]

/** 订阅周期（天）：链上无法自动扣款，到期需手动续费 */
export const SUBSCRIPTION_PERIOD_DAYS = 30
/** 订单有效期（分钟） */
export const ORDER_WINDOW_MINUTES = 30
/** 到期后的宽限期（天） */
export const GRACE_PERIOD_DAYS = 3

/**
 * 金额指纹：在档位价上叠加 0~9 分的尾数，降低「同档位同金额」订单的匹配歧义。
 * 用户被要求转账**精确金额**（含尾数），这是订单匹配法的关键。
 */
export const AMOUNT_FINGERPRINT_CENTS = 10

export function isChainKey(value: unknown): value is ChainKey {
  return typeof value === "string" && value in SUBSCRIPTION_CHAINS
}

export function isTokenSymbol(value: unknown): value is TokenSymbol {
  return value === "USDC" || value === "USDT"
}

/** USD 价格（分）→ 最小单位整数（BigInt），避免浮点误差 */
export function centsToRawUnits(amountCents: number, decimals: number): bigint {
  const scale = decimals - 2
  return BigInt(amountCents) * 10n ** BigInt(Math.max(0, scale))
}

/** 最小单位整数 → 人类可读数量（字符串，避免精度丢失） */
export function rawUnitsToAmount(raw: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals)
  const whole = raw / base
  const frac = raw % base
  if (frac === 0n) return whole.toString()
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "")
  return `${whole.toString()}.${fracStr}`
}
