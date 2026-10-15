import {
  createGateway,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  generateId,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai"
import { getCatalogModelBySlug } from "@/lib/ai-gateway/client"
import { isFreeModel } from "@/lib/ai-gateway/shared"
import { estimateCost } from "@/lib/compute/service"
import { recordUsage } from "@/lib/neon/ai-usage"
import { getWalletSessionFromCookies } from "@/lib/neon/wallet-auth"
import { resolveSubject } from "@/lib/neon/identity"
import { checkQuota, consumeQuota } from "@/lib/neon/quota"
import { formatTokens } from "@/lib/compute/plans"
import type { ComputePlaygroundMeta } from "@/lib/compute/types"

/**
 * Playground（Chat）真实推理路由（AI SDK + Vercel AI Gateway）。
 *
 * - 服务端持有 AI_GATEWAY_API_KEY，浏览器永不接触上游密钥；
 * - 只允许真实目录中 gatewayType === "language" 的模型；
 * - 沿用 UI 消息流协议，额外回传 data-compute-meta（真实 token / 成本）；
 * - 每次调用落库 ai_gateway_usage（落库失败不影响响应）。
 *
 * 访问控制（2026-10-16，见 docs/PRICING_AND_ENTITLEMENTS.md）：
 * - 免费模型由 Coolha 赞助算力，**必须签名登录**才可用（匿名 401）；匿名仍可走 BYOK 直连。
 * - 登录后按「每日 token 上限 + 每日请求上限」计量，超限 429。
 * - FREE_MODELS_ENABLED=0 可一键熔断免费通道（防 availability fallback 误扣 Credits）。
 */

type ComputePlaygroundMessage = UIMessage<unknown, { "compute-meta": ComputePlaygroundMeta }>

/**
 * 请求体上限 4MB（低于 Vercel Serverless 4.5MB 限制）。
 * 客户端会先把图片压缩到长边 1600px / JPEG 0.85（通常 200-400KB），
 * 因此该上限留足了多图 + 历史消息的余量。
 */
const MAX_BODY_BYTES = 4 * 1024 * 1024
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20

/** 进程内滑动窗口限流（兜底防滥用；跨实例不共享，真实配额需后续接入 KV） */
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

function jsonError(status: number, code: string, message: string, requestId: string) {
  return Response.json({ error: { code, message, requestId } }, { status })
}

function clientKeyOf(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? ""
  return forwarded.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown"
}

interface GatewayMeta {
  generationId?: string
  resolvedProvider?: string
  cost: number | null
}

function readGatewayMeta(providerMetadata: unknown): GatewayMeta {
  const gateway = (providerMetadata as { gateway?: Record<string, unknown> } | undefined)?.gateway
  if (!gateway) return { cost: null }

  const rawCost = gateway.cost
  const cost = typeof rawCost === "number" ? rawCost : Number(rawCost)
  const routing = gateway.routing as { finalProvider?: unknown } | undefined

  return {
    generationId: typeof gateway.generationId === "string" ? gateway.generationId : undefined,
    resolvedProvider:
      typeof routing?.finalProvider === "string" ? routing.finalProvider : undefined,
    cost: Number.isFinite(cost) ? cost : null,
  }
}

export async function POST(req: Request) {
  const requestId = `req_${generateId()}`

  // 地理合规二次防御：proxy.ts 已对 hard-block 地区直接返回 451
  if (req.headers.get("x-coolha-geo-access-tier") === "hard-block") {
    return jsonError(451, "SERVICE_UNAVAILABLE_IN_YOUR_REGION", "当前地区暂不支持该服务", requestId)
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey) {
    return jsonError(
      503,
      "GATEWAY_NOT_CONFIGURED",
      "AI Gateway 未配置，无法发起真实调用",
      requestId,
    )
  }

  // 全局熔断开关：成本异常时一键关闭免费通道（默认开启）
  if (process.env.FREE_MODELS_ENABLED === "0") {
    return jsonError(
      503,
      "FREE_CHANNEL_DISABLED",
      "免费模型通道已临时关闭，请添加自己的模型与 API Key 继续对话",
      requestId,
    )
  }

  if (!checkRateLimit(clientKeyOf(req))) {
    return jsonError(429, "RATE_LIMITED", "请求过于频繁，请稍后再试", requestId)
  }

  // 身份门禁：免费模型由 Coolha 赞助算力，必须签名登录才可用
  const session = await getWalletSessionFromCookies()
  const walletAddress = session?.address ?? null
  if (!walletAddress) {
    return jsonError(
      401,
      "AUTH_REQUIRED",
      "免费模型需要先连接钱包并签名登录；你也可以添加自己的模型与 API Key 直接对话。",
      requestId,
    )
  }
  // 业务主键：钱包地址 → users.id（地址是凭证，user_id 才是「人」）
  const subject = await resolveSubject(walletAddress)

  const contentLength = Number(req.headers.get("content-length") ?? "0")
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonError(
      413,
      "PAYLOAD_TOO_LARGE",
      "消息或图片过大，请减少图片数量或压缩后重试（单次请求上限 4MB）",
      requestId,
    )
  }

  let body: { model?: unknown; messages?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonError(400, "INVALID_JSON", "请求体不是合法 JSON", requestId)
  }

  const slug = typeof body.model === "string" ? body.model : ""
  const model = slug ? await getCatalogModelBySlug(slug) : null
  if (!model) {
    return jsonError(404, "MODEL_NOT_FOUND", "模型不存在", requestId)
  }
  if (model.gatewayType !== "language") {
    return jsonError(
      400,
      "UNSUPPORTED_MODEL_TYPE",
      "Playground 仅支持对话类（language）模型",
      requestId,
    )
  }
  // 公开访问仅允许免费模型：付费模型随订阅制开放（服务端硬门禁，客户端过滤仅为体验）
  if (!isFreeModel(model)) {
    return jsonError(
      403,
      "PAID_MODEL_NOT_ALLOWED",
      "公开 Playground 仅支持免费模型；付费模型将在订阅制开放后提供。你也可以在 Playground 中添加自己的模型与 API Key 直接对话。",
      requestId,
    )
  }
  if (!Array.isArray(body.messages)) {
    return jsonError(400, "INVALID_MESSAGES", "messages 必须为数组", requestId)
  }

  // 免费额度：按「每日 token + 每日请求次数」双上限计量（UTC 自然日）
  const quota = await checkQuota(subject)
  if (!quota.allowed) {
    const message =
      quota.reason === "REQUEST_LIMIT"
        ? `今日免费额度已用完（${quota.used.requests}/${quota.plan.quota.dailyRequests} 次）。额度 UTC 明日 00:00 重置，你也可以切换自己的模型继续。`
        : `今日免费额度已用完（${formatTokens(quota.used.tokens)}/${formatTokens(quota.plan.quota.dailyTokens)} tokens）。额度 UTC 明日 00:00 重置，你也可以切换自己的模型继续。`
    return Response.json(
      {
        error: {
          code: "QUOTA_EXCEEDED",
          message,
          requestId,
          quota: {
            plan: quota.plan.id,
            reason: quota.reason,
            usedRequests: quota.used.requests,
            usedTokens: quota.used.tokens,
            limitRequests: quota.plan.quota.dailyRequests,
            limitTokens: quota.plan.quota.dailyTokens,
            resetAt: quota.resetAt,
          },
        },
      },
      { status: 429 },
    )
  }

  const startedAt = Date.now()
  const gateway = createGateway({
    apiKey,
    ...(process.env.AI_GATEWAY_BASE_URL ? { baseURL: process.env.AI_GATEWAY_BASE_URL } : {}),
  })

  let result: ReturnType<typeof streamText>
  try {
    result = streamText({
      model: gateway(model.modelId),
      messages: await convertToModelMessages(body.messages as UIMessage[]),
    })
  } catch (error) {
    console.error("[compute/playground] 构造请求失败:", error)
    return jsonError(400, "INVALID_REQUEST", "无法构造模型请求", requestId)
  }

  const stream = createUIMessageStream<ComputePlaygroundMessage>({
    execute: async ({ writer }) => {
      // sendReasoning：nemotron 等推理模型会把思考过程放在 reasoning 分片
      await writer.merge(
        toUIMessageStream({
          stream: result.fullStream,
          sendReasoning: true,
          onError: (error) => {
            console.error("[compute/playground] 上游流错误:", error)
            return "上游模型返回错误，请稍后重试"
          },
        }),
      )

      const usage = await result.usage
      let providerMetadata: unknown
      try {
        providerMetadata = await result.providerMetadata
      } catch {
        providerMetadata = undefined
      }
      const gatewayMeta = readGatewayMeta(providerMetadata)
      const inputTokens = usage.inputTokens ?? 0
      const outputTokens = usage.outputTokens ?? 0

      const fallbackCost = estimateCost(model, inputTokens, outputTokens).totalCostUsd
      const costUsd = gatewayMeta.cost ?? fallbackCost

      const meta: ComputePlaygroundMeta = {
        requestId,
        mode: "live",
        modelId: model.modelId,
        inputTokens,
        outputTokens,
        totalTokens: usage.totalTokens ?? inputTokens + outputTokens,
        costUsd,
        latencyMs: Date.now() - startedAt,
        // 上游未回传 cost 时按目录单价线性估算
        estimated: gatewayMeta.cost === null,
        generationId: gatewayMeta.generationId,
        resolvedProvider: gatewayMeta.resolvedProvider,
      }
      writer.write({ type: "data-compute-meta", data: meta, transient: true })

      void recordUsage({
        requestId,
        generationId: gatewayMeta.generationId ?? null,
        modelId: model.modelId,
        providerId: model.providerId,
        resolvedProvider: gatewayMeta.resolvedProvider ?? null,
        source: "playground",
        walletAddress: subject,
        clientKey: clientKeyOf(req),
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs: meta.latencyMs,
      }).catch((error) => {
        console.error("[compute/playground] 用量落库失败:", error)
      })

      void consumeQuota(subject, inputTokens, outputTokens).catch((error) => {
        console.error("[compute/playground] 额度记账失败:", error)
      })
    },
    onError: (error) => {
      console.error("[compute/playground] 流处理错误:", error)
      return "推理服务内部错误，请重试"
    },
  })

  return createUIMessageStreamResponse({ stream })
}

export async function GET() {
  return jsonError(405, "METHOD_NOT_ALLOWED", "请使用 POST 发送消息", "req_na")
}
