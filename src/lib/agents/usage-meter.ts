import "server-only"

import { estimateCostUsd } from "@/lib/agents/pricing"
import { recordInferenceUsage } from "@/lib/neon/agent-billing"

/**
 * 推理计量：把 eve 会话事件流里的用量事实抽出来，记账到 Neon。
 *
 * 事件流的形状（实测 eve@1.0.0-rc.9，NDJSON，每行一个 JSON）：
 *   {"at":"...","facts":[
 *      {"type":"model.started","data":{"modelId":"OpenRouter/deepseek/...","runId":"run_0"}},
 *      {"type":"usage.recorded","data":{"kind":"model","usage":{"inputTokens":957,"outputTokens":252,"cacheReadTokens":896}}}
 *   ]}
 *
 * 为什么在代理层计量：
 *  - 用量事实本来就流经我们的受控代理，不需要给推理链路加新的旁路；
 *  - 闸门（额度用满即拒）也在同一层生效，请求根本不会到上游。
 *
 * 诚实纪律：单价拿不到 → cost 记 null（不写 0），token 照记。
 */

export interface UsageFact {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  modelId: string | null
}

interface FactLike {
  type?: unknown
  data?: unknown
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** 从一行 JSON 里抽出所有事实（兼容 facts 数组与单条事实两种形状） */
function factsOf(payload: unknown): FactLike[] {
  const record = asRecord(payload)
  if (!record) return []
  const list = record.facts
  if (Array.isArray(list)) return list as FactLike[]
  if (typeof record.type === "string") return [record as FactLike]
  return []
}

/**
 * 从一段流文本里抽取用量事实与模型 ID。
 * 兼容 NDJSON（eve 当前格式）与标准 SSE 的 `data:` 前缀。
 */
export function extractUsageFromText(text: string): UsageFact[] {
  const out: UsageFact[] = []
  let modelId: string | null = null

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith(":") || line.startsWith("event:")) continue
    const payload = line.startsWith("data:") ? line.slice(5).trim() : line
    if (!payload || payload === "[DONE]") continue

    let parsed: unknown
    try {
      parsed = JSON.parse(payload)
    } catch {
      continue
    }

    for (const fact of factsOf(parsed)) {
      const data = asRecord(fact.data)
      if (!data) continue

      if (fact.type === "model.started") {
        const id = data.modelId
        if (typeof id === "string" && id) modelId = id
        continue
      }

      if (fact.type !== "usage.recorded") continue
      const usage = asRecord(data.usage)
      if (!usage) continue
      out.push({
        inputTokens: num(usage.inputTokens),
        outputTokens: num(usage.outputTokens),
        cacheReadTokens: num(usage.cacheReadTokens),
        modelId,
      })
    }
  }
  return out
}

export interface MeterContext {
  subject: string
  grantId: string | null
  sessionId: string | null
  /** 兜底模型 ID（流里还没出现 model.started 时用） */
  fallbackModelId?: string | null
  requestId?: string | null
}

/**
 * 把上游事件流 tee 一份：原样转发给浏览器，同时把用量记账。
 * 记账不阻塞转发（fire-and-forget），失败只记日志，不影响用户看到回复。
 */
export function teeAndMeterUsage(
  body: ReadableStream<Uint8Array>,
  ctx: MeterContext,
): ReadableStream<Uint8Array> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  // model.started 常常在更早的分块里，模型 id 要跨分块带着走
  let lastModelId: string | null = null

  async function handle(text: string) {
    const facts = extractUsageFromText(text)
    for (const fact of facts) {
      if (fact.modelId) lastModelId = fact.modelId
      const modelId = fact.modelId ?? lastModelId ?? ctx.fallbackModelId ?? null
      const costUsd = modelId
        ? await estimateCostUsd({
            modelId,
            inputTokens: fact.inputTokens,
            outputTokens: fact.outputTokens,
            cacheReadTokens: fact.cacheReadTokens,
          })
        : null
      await recordInferenceUsage({
        subject: ctx.subject,
        grantId: ctx.grantId,
        sessionId: ctx.sessionId,
        model: modelId,
        inputTokens: fact.inputTokens,
        outputTokens: fact.outputTokens,
        cacheReadTokens: fact.cacheReadTokens,
        costUsd,
        source: "chat",
        requestId: ctx.requestId ?? null,
      })
    }
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read()
      if (done) {
        try {
          if (buffer.trim()) await handle(buffer)
        } catch {
          // 结束时也要把残余行记完
        }
        controller.close()
        return
      }
      controller.enqueue(value)
      try {
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        const text = lines.join("\n")
        if (text.trim()) {
          // 不 await：计量失败不应该拖慢用户看回复
          void handle(text).catch((error) =>
            console.error("[usage] 计量失败:", error instanceof Error ? error.name : "error"),
          )
        }
      } catch (error) {
        console.error("[usage] 解析事件流失败:", error instanceof Error ? error.name : "error")
      }
    },
    cancel(reason) {
      void reader.cancel(reason)
    },
  })
}
