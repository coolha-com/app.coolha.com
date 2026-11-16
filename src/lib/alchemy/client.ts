import "server-only"

import { chainByKey } from "@/lib/chains/registry"
import { isChainKey, SUBSCRIPTION_CHAINS, type ChainKey } from "@/lib/subscription/config"

/**
 * Alchemy JSON-RPC 客户端 —— **全站唯一实现**。
 *
 * 之前这个仓库里有三份互不相干的 Alchemy 调用代码（`research/sources.ts` 硬编码
 * eth-mainnet、`subscription/scan.ts` 自己拼 URL、`web3-tools/alchemy.ts` 又写了一份
 * 带错误分类的）。三份各修各的 bug、凭证约定还略有差异。现在统一到这里。
 *
 * 铁律：
 * 1. **密钥只在服务端读**（`process.env`），永不进入浏览器响应、永不写进任何文件。
 * 2. **只读**。本模块只做 JSON-RPC 查询，不构造、不广播任何交易。
 * 3. **错误必须可分类**。上游异常统一抛 `AlchemyError`（带 code），
 *    调用方据此区分「未配置 / 超时 / 限流 / 鉴权失败 / 上游故障」，
 *    而不是一律降级成 null —— null 无法区分「没配 key」和「上游挂了」。
 * 4. **错误信息不得夹带密钥**。抛错前统一脱敏（见 `redact`）。
 * 5. 订阅扫链仍走 Base / Ethereum。RWA 已接通的链走 Chain Registry，
 *    未接入的链直接拒绝，不发起 RPC。
 */

const RPC_TIMEOUT_MS = 12_000

/** 错误分类。上层据此决定 HTTP 状态码与用户可见文案。 */
export type AlchemyErrorCode =
  /** 服务端没有配置 Alchemy 凭证 */
  | "NOT_CONFIGURED"
  /** 请求超时 */
  | "UPSTREAM_TIMEOUT"
  /** 上游限流（HTTP 429） */
  | "UPSTREAM_RATE_LIMIT"
  /** 上游鉴权失败（HTTP 401/403）—— 通常意味着 key 失效 */
  | "UPSTREAM_AUTH"
  /** 其他上游故障（5xx / 网络错误 / JSON-RPC error） */
  | "UPSTREAM_ERROR"
  /** 上游返回体不符合 JSON-RPC 规范 */
  | "INVALID_RESPONSE"
  /** 链未在 RWA 登记中接通，且也不是订阅扫链网络 */
  | "NOT_CONNECTED"

export class AlchemyError extends Error {
  readonly code: AlchemyErrorCode
  /** 该错误重试是否可能成功（限流/超时为 true，鉴权失败为 false） */
  readonly retryable: boolean

  constructor(code: AlchemyErrorCode, message: string, retryable = false) {
    super(message)
    this.name = "AlchemyError"
    this.code = code
    this.retryable = retryable
  }
}

/**
 * 读取服务端 Alchemy 凭证。
 *
 * 约定与既有代码一致：`ALCHEMY_KEY` 优先，`ALCHEMY_ID` 兜底。
 * 空串按「未配置」处理，避免一个空变量把另一个有效值挡掉（`??` 只挡 null/undefined）。
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

function networkOf(chain: string): { subdomain: string; chainId: number } {
  if (isChainKey(chain)) {
    const config = SUBSCRIPTION_CHAINS[chain]
    return { subdomain: config.rpcSubdomain, chainId: config.id }
  }
  const entry = chainByKey(chain)
  if (entry?.access === "connected" && entry.alchemySubdomain) {
    return { subdomain: entry.alchemySubdomain, chainId: entry.chainId }
  }
  throw new AlchemyError(
    "NOT_CONNECTED",
    entry ? `${entry.label} 未接入，本次没有发起 RPC` : "未知链，本次没有发起 RPC",
    false,
  )
}

/** 完整 RPC URL（含密钥）。**只在服务端内部使用，禁止回传浏览器、禁止写日志。** */
export function alchemyRpcUrl(chain: ChainKey | string): string | null {
  const key = readAlchemyKey()
  if (!key) return null
  try {
    return `https://${networkOf(chain).subdomain}.g.alchemy.com/v2/${key}`
  } catch {
    return null
  }
}

/** 端点标识：只有子域，不含密钥。可安全进响应体与日志。 */
export function alchemyEndpointLabel(chain: string): string {
  return `${networkOf(chain).subdomain}.g.alchemy.com`
}

/** 错误信息脱敏：上游报错里可能夹带 key，输出前先抹掉（红线 11） */
function redact(message: string): string {
  const key = readAlchemyKey()
  if (!key) return message
  return message.split(key).join("[redacted]")
}

/**
 * 发一次 JSON-RPC 查询。
 *
 * @param chain 订阅网络，或 RWA 登记里已接通的链
 * @param method JSON-RPC 方法名
 * @param params 参数数组
 * @returns `result` 字段的原始值（类型由调用方负责校验）
 * @throws {AlchemyError} 凭证缺失 / 链未接入 / 超时 / 限流 / 鉴权失败 / 上游故障
 */
export async function alchemyRpc(
  chain: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const key = readAlchemyKey()
  if (!key) throw new AlchemyError("NOT_CONFIGURED", "ALCHEMY_KEY 未配置", false)

  const url = `https://${networkOf(chain).subdomain}.g.alchemy.com/v2/${key}`

  let res: Response
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      cache: "no-store",
      signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
    })
  } catch (error) {
    const name = error instanceof Error ? error.name : ""
    if (name === "TimeoutError" || name === "AbortError") {
      throw new AlchemyError(
        "UPSTREAM_TIMEOUT",
        `Alchemy ${method} 超时（${RPC_TIMEOUT_MS}ms）`,
        true,
      )
    }
    const detail = error instanceof Error ? error.message : "unknown error"
    throw new AlchemyError(
      "UPSTREAM_ERROR",
      `Alchemy ${method} 请求失败：${redact(detail)}`,
      true,
    )
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new AlchemyError(
        "UPSTREAM_AUTH",
        `Alchemy 鉴权失败（HTTP ${res.status}），凭证可能已失效`,
        false,
      )
    }
    if (res.status === 429) {
      throw new AlchemyError("UPSTREAM_RATE_LIMIT", "Alchemy 限流（HTTP 429）", true)
    }
    throw new AlchemyError("UPSTREAM_ERROR", `Alchemy 返回 HTTP ${res.status}`, true)
  }

  const json = (await res.json()) as {
    result?: unknown
    error?: { message?: string }
  }
  if (json.error) {
    throw new AlchemyError(
      "UPSTREAM_ERROR",
      `Alchemy ${method} 报错：${redact(json.error.message ?? "unknown")}`,
      true,
    )
  }
  if (!("result" in json)) {
    throw new AlchemyError(
      "INVALID_RESPONSE",
      `Alchemy ${method} 返回体缺少 result 字段`,
      true,
    )
  }
  return json.result
}

/** 十六进制字符串 → BigInt；不是合法 hex 时返回 null（不抛异常，让上层标 unknown） */
export function hexToBigInt(value: unknown): bigint | null {
  if (typeof value !== "string" || !value.startsWith("0x")) return null
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

/**
 * 判定一个地址是否为合约：运行时字节码非空。
 *
 * 与 `research/sources.ts` 共用同一份判定语义，避免两处各写一遍。
 */
export function isContractBytecode(code: unknown): boolean {
  return typeof code === "string" && code.startsWith("0x") && code.length > 2
}
