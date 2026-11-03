import { AlchemyNotConfiguredError, AlchemyUpstreamError, fetchChainSnapshot, isAlchemyConfigured, isToolChain, TOOL_CHAIN_KEYS } from "@/lib/web3-tools/alchemy"
import { WEB3_TOOLS } from "@/lib/web3-tools/catalog"

export const dynamic = "force-dynamic"
// Alchemy 密钥只在服务端读取（process.env），必须跑在 Node runtime
export const runtime = "nodejs"

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20

/** 进程内滑动窗口限流（防匿名刷爆付费上游配额；跨实例不共享） */
const rateHits = new Map<string, number[]>()

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const recent = (rateHits.get(key) ?? []).filter((at) => now - at < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    rateHits.set(key, recent)
    return false
  }
  recent.push(now)
  rateHits.set(key, recent)
  if (rateHits.size > 5_000) rateHits.clear()
  return true
}

function clientKeyOf(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? ""
  return forwarded.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown"
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

/** 只认我们真正接了执行点的那一个工具；其余一律「未接入」 */
const LIVE_TOOL_IDS = new Set(["alchemy-mcp-server"])

/** 上游错误信息里可能夹带 key，输出前先抹掉（红线 11：凭证值不得出现在任何响应里） */
function sanitize(message: string): string {
  for (const candidate of [process.env.ALCHEMY_KEY, process.env.ALCHEMY_ID]) {
    const key = candidate?.trim()
    if (!key) continue
    message = message.split(key).join("[redacted]")
  }
  return message
}

function toolMeta(slug: string) {
  const tool = WEB3_TOOLS.find((t) => t.id === slug)
  return {
    id: slug,
    name: tool?.name ?? slug,
    integration: LIVE_TOOL_IDS.has(slug) ? ("live" as const) : ("none" as const),
  }
}

/**
 * GET /api/ai/tools/[slug] —— 工具层的真实执行点（当前只有 Alchemy 读链）。
 *
 * ⚠️ 诚实口径：
 * - 未接入的工具返回 404 + `status: "not_integrated"`，**不返回任何模拟数据**。
 * - 密钥未配置返回 503 + `status: "not_configured"`，**不伪装成「查不到」**。
 * - 只有真实 RPC 成功时才返回 `status: "live"` 与实测数值。
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  if (!LIVE_TOOL_IDS.has(slug)) {
    return Response.json(
      {
        tool: toolMeta(slug),
        status: "not_integrated",
        message: "该工具尚未接入，Coolha 目前不提供任何调用入口。",
      },
      { status: 404 },
    )
  }

  if (!checkRateLimit(clientKeyOf(req))) {
    return Response.json(
      { tool: toolMeta(slug), status: "rate_limited", message: "请求过于频繁，请稍后再试。" },
      { status: 429 },
    )
  }

  const url = new URL(req.url)
  const chainParam = url.searchParams.get("chain") ?? "ethereum"
  if (!isToolChain(chainParam)) {
    return Response.json(
      {
        tool: toolMeta(slug),
        status: "invalid_request",
        message: `chain 参数无效，可选值：${TOOL_CHAIN_KEYS.join(" / ")}。`,
      },
      { status: 400 },
    )
  }

  const addressParam = url.searchParams.get("address")?.trim() || null
  if (addressParam && !ADDRESS_RE.test(addressParam)) {
    return Response.json(
      {
        tool: toolMeta(slug),
        status: "invalid_request",
        message: "address 必须是 0x 开头的 40 位十六进制地址。",
      },
      { status: 400 },
    )
  }

  if (!isAlchemyConfigured()) {
    return Response.json(
      {
        tool: toolMeta(slug),
        status: "not_configured",
        message: "服务端未配置 ALCHEMY_KEY，Alchemy 读链当前不可用（未接入）。",
      },
      { status: 503 },
    )
  }

  const startedAt = Date.now()
  try {
    const snapshot = await fetchChainSnapshot(chainParam, addressParam)

    const unknown: string[] = []
    if (snapshot.blockTime === null) unknown.push("最新区块时间戳未取到")
    if (addressParam && snapshot.balanceEth === null) unknown.push("原生币余额未取到")
    if (addressParam && snapshot.txCount === null) unknown.push("交易计数（nonce）未取到")

    return Response.json(
      {
        tool: toolMeta(slug),
        status: "live",
        chain: { key: snapshot.chain, id: snapshot.chainId, label: snapshot.label },
        address: snapshot.address,
        data: {
          blockNumber: snapshot.blockNumber,
          blockTime: snapshot.blockTime,
          balanceEth: snapshot.balanceEth,
          balanceWei: snapshot.balanceWei,
          txCount: snapshot.txCount,
        },
        source: {
          provider: "alchemy-rpc",
          method: addressParam
            ? "eth_blockNumber / eth_getBlockByNumber / eth_getBalance / eth_getTransactionCount"
            : "eth_blockNumber / eth_getBlockByNumber",
        },
        unknown,
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    if (error instanceof AlchemyNotConfiguredError) {
      return Response.json(
        {
          tool: toolMeta(slug),
          status: "not_configured",
          message: "服务端未配置 ALCHEMY_KEY，Alchemy 读链当前不可用（未接入）。",
        },
        { status: 503 },
      )
    }

    const reason =
      error instanceof AlchemyUpstreamError ? sanitize(error.message) : "上游请求失败"
    console.error("[api/ai/tools] Alchemy 读链失败:", reason)
    return Response.json(
      {
        tool: toolMeta(slug),
        status: "upstream_error",
        message: `Alchemy 上游不可用：${reason}`,
      },
      { status: 502 },
    )
  }
}
