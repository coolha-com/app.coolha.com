import type { ChainKey } from "@/lib/subscription/config"

/**
 * 工具层证据信封（Evidence Envelope）。
 *
 * 契约来源：`docs/WEB3_TOOL_REGISTRY_PHASE1_PLAN.md` §4。
 *
 * ⛔ 本项目的历史事故：`/ai/research` 曾经编造 0-100 风险分，`/ai/tools` 曾经
 * 整页都是「未接入」却看不出哪些能用。工具层的每一条对外结论都必须装进这个信封里，
 * 否则就是卖空气 + 编数据。
 *
 * 四条硬规则（与 `src/lib/research/engine.ts` 的纪律一致）：
 *
 * 1. **先取数再断言**：没有工具结果支撑的结论不得输出。
 * 2. **每条关键结论必须可溯源**：关联数据源、方法、链、端点、抓取时间。
 * 3. **没查到就说没查到**：取不到的项进 `unknown`，**不允许用常识或预训练记忆补齐**。
 * 4. **声明覆盖边界**：截断、估算、缺失都要在 `warnings` / `coverage` 里照实说出来。
 *
 * ⛔ 本模块**不得**生成任何评分、概率、评级或「看起来合理」的推断值。
 * 工具层只搬运上游真实返回的原始事实。
 */

/** 数据源标识。与计划书 §4 的 provider 枚举保持一致。 */
export type ToolProvider =
  | "alchemy-rpc"
  | "alchemy-index"
  | "defillama"
  | "selector-registry"
  | "explorer"

/** 证据来源：每条结论都能顺着它回到具体的一次真实调用。 */
export interface ToolSource {
  provider: ToolProvider
  /** 具体方法名，如 eth_getBalance；多个方法用 " / " 连接 */
  method: string
  /** 端点标识（**不含密钥**），如 base-mainnet.g.alchemy.com */
  endpoint: string
  chain: ChainKey
  chainId: number
  /** ISO 时间戳 */
  fetchedAt: string
  latencyMs: number
}

/** 覆盖范围声明。模型与 UI 必须照此声明，不得扩大。 */
export interface ToolCoverage {
  /** 区块起点 */
  fromBlock?: number | string
  /** 区块终点 */
  toBlock?: number | string
  /** 起始地址 / 目标 */
  from?: string
  /** 结束地址 / 目标 */
  to?: string
  /** 本次请求的时间窗 */
  requestedWindow?: string
  /** 返回结果是否被截断 */
  truncated?: boolean
  /** 本次实际返回的条数 */
  returnedItems?: number
  /** 自由说明：估算方式、区间口径等 */
  note?: string
}

/** 结构化错误。失败也必须结构化，不能抛异常给上层。 */
export interface ToolError {
  code: string
  message: string
  /** 重试是否可能成功 */
  retryable?: boolean
}

/**
 * 工具返回值信封。
 *
 * `data` 为 null 表示**没查到**（或上游不可用）；此时 `unknown` / `error` 必须说明原因。
 * 任何情况下都**不得**在 `data` 里放占位数值。
 */
export interface ToolResult<T> {
  /** 是否成功取到数据。false 时 `data` 必为 null。 */
  ok: boolean
  /** 工具标识（目录条目 id） */
  tool: string
  source: ToolSource
  data: T | null
  /** 数据覆盖局限：截断、估算、区间口径、缺失 */
  warnings: string[]
  /** 明确「没查到 / 无法确认」的项 —— 模型不得补齐 */
  unknown: string[]
  coverage?: ToolCoverage
  error?: ToolError
}

/** 错误码归一：把上游各种异常压成稳定的一组 code。 */
export const TOOL_ERROR_CODES = {
  NOT_CONFIGURED: "NOT_CONFIGURED",
  UPSTREAM_TIMEOUT: "UPSTREAM_TIMEOUT",
  UPSTREAM_RATE_LIMIT: "UPSTREAM_RATE_LIMIT",
  UPSTREAM_AUTH: "UPSTREAM_AUTH",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  INVALID_RESPONSE: "INVALID_RESPONSE",
  INVALID_REQUEST: "INVALID_REQUEST",
  NOT_INTEGRATED: "NOT_INTEGRATED",
} as const

export type ToolErrorCode = (typeof TOOL_ERROR_CODES)[keyof typeof TOOL_ERROR_CODES]

/** HTTP 状态码 → 错误 code 的映射，供路由层统一处理 */
const STATUS_TO_CODE: Record<number, ToolErrorCode> = {
  400: TOOL_ERROR_CODES.INVALID_REQUEST,
  404: TOOL_ERROR_CODES.NOT_INTEGRATED,
  429: TOOL_ERROR_CODES.UPSTREAM_RATE_LIMIT,
  502: TOOL_ERROR_CODES.UPSTREAM_ERROR,
  503: TOOL_ERROR_CODES.NOT_CONFIGURED,
}

/**
 * trace() —— 工具调用的统一包装器。
 *
 * 职责：
 * 1. 计时（latencyMs）
 * 2. 异常捕获：把任何抛出的错误转成结构化 `error`，**不中断整条推理**
 * 3. 错误码归一
 * 4. 保证 `ok=false` 时 `data` 必为 null、`unknown` 必非空
 *
 * 用法：
 * ```ts
 * const result = await trace({
 *   tool: "alchemy-mcp-server",
 *   source: { provider: "alchemy-rpc", method: "eth_getBalance", endpoint, chain, chainId },
 *   fn: async () => ({ data, warnings, unknown, coverage }),
 * })
 * ```
 */
export async function trace<T>(options: {
  tool: string
  source: Omit<ToolSource, "fetchedAt" | "latencyMs">
  fn: () => Promise<{
    data: T | null
    warnings?: string[]
    unknown?: string[]
    coverage?: ToolCoverage
  }>
}): Promise<ToolResult<T>> {
  const startedAt = Date.now()
  const fetchedAt = new Date().toISOString()

  const base = {
    tool: options.tool,
    source: {
      ...options.source,
      fetchedAt,
      latencyMs: 0,
    },
  }

  try {
    const outcome = await options.fn()
    const warnings = outcome.warnings ?? []
    const unknown = outcome.unknown ?? []

    // 工具没报错但也没给数据 —— 同样是一种失败，必须有结构化 error，
    // 否则上层会看到「ok:false 但没有 error」的不一致信封。
    if (outcome.data === null) {
      return {
        ok: false,
        ...base,
        source: { ...base.source, latencyMs: Date.now() - startedAt },
        data: null,
        warnings,
        unknown:
          unknown.length > 0 ? unknown : ["工具未取到任何数据，且未说明原因"],
        error: {
          code: TOOL_ERROR_CODES.UPSTREAM_ERROR,
          message: "工具未取到任何数据",
          retryable: true,
        },
      }
    }

    return {
      ok: true,
      ...base,
      source: { ...base.source, latencyMs: Date.now() - startedAt },
      data: outcome.data,
      warnings,
      unknown,
      coverage: outcome.coverage,
    }
  } catch (error) {
    const code = resolveErrorCode(error)
    const message = error instanceof Error ? error.message : "工具执行失败"
    const retryable = isRetryable(error)

    return {
      ok: false,
      ...base,
      source: { ...base.source, latencyMs: Date.now() - startedAt },
      data: null,
      warnings: [],
      // 失败也是一个「没查到」，必须显式声明，不能让上层以为没失败
      unknown: ["工具执行失败，未取到任何数据"],
      error: { code, message, retryable },
    }
  }
}

/**
 * 错误码归一。
 *
 * 优先读 `AlchemyError.code`（共享客户端抛的），否则退回 HTTP 状态码映射，
 * 最后兜底为 UPSTREAM_ERROR。
 */
export function resolveErrorCode(error: unknown): ToolErrorCode {
  const candidate = (error as { code?: unknown })?.code
  if (typeof candidate === "string" && candidate in TOOL_ERROR_CODES) {
    return candidate as ToolErrorCode
  }

  const status = (error as { status?: unknown })?.status
  if (typeof status === "number" && STATUS_TO_CODE[status]) {
    return STATUS_TO_CODE[status]
  }

  return TOOL_ERROR_CODES.UPSTREAM_ERROR
}

/** 是否值得重试：限流与超时可重试；未配置与鉴权失败重试也没用。 */
export function isRetryable(error: unknown): boolean {
  const candidate = (error as { retryable?: unknown })?.retryable
  if (typeof candidate === "boolean") return candidate

  const code = resolveErrorCode(error)
  return (
    code === TOOL_ERROR_CODES.UPSTREAM_TIMEOUT ||
    code === TOOL_ERROR_CODES.UPSTREAM_RATE_LIMIT ||
    code === TOOL_ERROR_CODES.UPSTREAM_ERROR
  )
}
