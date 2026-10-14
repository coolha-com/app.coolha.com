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
import { estimateCost } from "@/lib/compute/service"
import { recordUsage } from "@/lib/neon/ai-usage"
import type { ComputePlaygroundMeta } from "@/lib/compute/types"

/**
 * Playground 真实推理路由（AI SDK + Vercel AI Gateway）。
 *
 * - 服务端持有 AI_GATEWAY_API_KEY，浏览器永不接触上游密钥；
 * - 只允许真实目录中 gatewayType === "language" 的模型；
 * - 沿用 UI 消息流协议，额外回传 data-compute-meta（真实 token / 成本）；
 * - 每次调用落库 ai_gateway_usage（落库失败不影响响应）。
 */

type ComputePlaygroundMessage = UIMessage<unknown, { "compute-meta": ComputePlaygroundMeta }>

const MAX_BODY_BYTES = 256 * 1024
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

  if (!checkRateLimit(clientKeyOf(req))) {
    return jsonError(429, "RATE_LIMITED", "请求过于频繁，请稍后再试", requestId)
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0")
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonError(413, "PAYLOAD_TOO_LARGE", "请求体超过大小限制", requestId)
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
  if (!Array.isArray(body.messages)) {
    return jsonError(400, "INVALID_MESSAGES", "messages 必须为数组", requestId)
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
        clientKey: clientKeyOf(req),
        inputTokens,
        outputTokens,
        costUsd,
        latencyMs: meta.latencyMs,
      }).catch((error) => {
        console.error("[compute/playground] 用量落库失败:", error)
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
