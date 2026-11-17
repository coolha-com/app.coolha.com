/** ERC-20 只读选择子与 ABI 解码。不含网络调用。 */

export const ERC20 = {
  name: "0x06fdde03",
  symbol: "0x95d89b41",
  decimals: "0x313ce567",
  totalSupply: "0x18160ddd",
  balanceOf: "0x70a08231",
} as const

/** EIP-1967 implementation slot。只作可核验提示，不解释成发行方。 */
export const EIP1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export function isAddress(value: string): boolean {
  return ADDRESS_RE.test(value)
}

export function balanceOfData(holder: string): string {
  return ERC20.balanceOf + holder.slice(2).toLowerCase().padStart(64, "0")
}

export function decodeUint(hex: unknown): bigint | null {
  if (typeof hex !== "string" || !hex.startsWith("0x") || hex.length < 3) return null
  try {
    return BigInt(hex)
  } catch {
    return null
  }
}

function utf8FromHex(hex: string): string | null {
  if (hex.length === 0 || hex.length % 2 !== 0) return null
  try {
    const bytes = Buffer.from(hex, "hex")
    const text = bytes.toString("utf8").replace(/\u0000/g, "").trim()
    if (!text || !/^[\x20-\x7E]+$/.test(text)) return null
    return text
  } catch {
    return null
  }
}

/** 动态 string 或 bytes32。解不出来返回 null，不猜测。 */
export function decodeAbiString(hex: unknown): string | null {
  if (typeof hex !== "string" || !hex.startsWith("0x")) return null
  const body = hex.slice(2)
  if (body.length < 64 || body.length % 64 !== 0) return null

  let offset: bigint
  try {
    offset = BigInt(`0x${body.slice(0, 64)}`)
  } catch {
    return null
  }

  if (offset === 32n && body.length >= 128) {
    let length: number
    try {
      length = Number(BigInt(`0x${body.slice(64, 128)}`))
    } catch {
      return null
    }
    if (Number.isInteger(length) && length >= 0 && length <= 256 && body.length >= 128 + length * 2) {
      return utf8FromHex(body.slice(128, 128 + length * 2))
    }
  }

  const word = body.slice(0, 64).replace(/(00)+$/, "")
  return utf8FromHex(word)
}

export function formatUnits(raw: bigint, decimals: number): string {
  if (decimals <= 0) return raw.toString()
  const base = 10n ** BigInt(decimals)
  const whole = raw / base
  const frac = (raw % base).toString().padStart(decimals, "0").replace(/0+$/, "")
  return frac ? `${whole.toString()}.${frac}` : whole.toString()
}

/** 用整数算出百分比字符串。供应量不是正数时返回 null。 */
export function formatShare(balance: bigint, supply: bigint): string | null {
  if (supply <= 0n) return null
  const scaled = (balance * 1_000_000n) / supply
  const whole = scaled / 10_000n
  const frac = (scaled % 10_000n).toString().padStart(4, "0")
  return `${whole.toString()}.${frac}%`
}

export function addressFromSlot(hex: unknown): string | null {
  if (typeof hex !== "string" || !hex.startsWith("0x")) return null
  const body = hex.slice(2).padStart(64, "0")
  if (/^0+$/.test(body)) return null
  const address = `0x${body.slice(-40)}`
  return isAddress(address) ? address : null
}
