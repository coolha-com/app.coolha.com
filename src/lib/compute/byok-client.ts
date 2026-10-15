"use client"

/**
 * 浏览器直连用户自己的模型服务（OpenAI 兼容 /chat/completions，SSE 流式）。
 *
 * 请求不经过 Coolha 后端：API Key 只存在于浏览器内存与 localStorage，
 * Coolha 不经手、不存储、不计费。代价是目标端点必须允许浏览器跨域（CORS）。
 */

/** 消息内容：纯文本，或图文混合（图片为 data URL） */
export type ByokContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >

export interface ByokChatMessage {
  role: "system" | "user" | "assistant"
  content: ByokContent
}

export interface ByokUsage {
  inputTokens: number | null
  outputTokens: number | null
}

/** CORS 被拦截时 fetch 抛 TypeError，这里转成可读提示 */
function describeNetworkError(baseURL: string, error: unknown): Error {
  if (error instanceof TypeError) {
    return new Error(
      `无法直连 ${baseURL}：可能被浏览器跨域（CORS）限制。请改用支持浏览器直连的端点，或在服务端配置转发。`,
    )
  }
  return new Error(error instanceof Error ? error.message : "未知错误")
}

export async function streamCustomModel(options: {
  baseURL: string
  apiKey: string
  model: string
  messages: ByokChatMessage[]
  signal?: AbortSignal
  onDelta: (text: string) => void
  onDone?: (usage: ByokUsage) => void
}): Promise<void> {
  const { baseURL, apiKey, model, messages, signal, onDelta, onDone } = options

  let response: Response
  try {
    response = await fetch(`${baseURL.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal,
    })
  } catch (error) {
    throw describeNetworkError(baseURL, error)
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`上游返回 ${response.status}${detail ? `：${detail.slice(0, 200)}` : ""}`)
  }
  if (!response.body) {
    throw new Error("该端点未返回流式响应，请确认支持 stream: true")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  const usage: ByokUsage = { inputTokens: null, outputTokens: null }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE 以空行分隔事件
      const chunks = buffer.split("\n\n")
      buffer = chunks.pop() ?? ""

      for (const chunk of chunks) {
        for (const line of chunk.split("\n")) {
          const trimmed = line.trim()
          if (!trimmed.startsWith("data:")) continue
          const payload = trimmed.slice(5).trim()
          if (payload === "[DONE]") continue

          let parsed: {
            choices?: Array<{ delta?: { content?: string } }>
            usage?: { prompt_tokens?: number; completion_tokens?: number }
          }
          try {
            parsed = JSON.parse(payload)
          } catch {
            continue
          }

          if (parsed.usage) {
            usage.inputTokens = parsed.usage.prompt_tokens ?? usage.inputTokens
            usage.outputTokens = parsed.usage.completion_tokens ?? usage.outputTokens
          }
          const text = parsed.choices?.[0]?.delta?.content
          if (text) onDelta(text)
        }
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return
    throw describeNetworkError(baseURL, error)
  } finally {
    reader.releaseLock()
  }

  onDone?.(usage)
}
