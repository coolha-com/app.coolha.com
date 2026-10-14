import type { ComputeModel } from "./types"

/**
 * Playground Mock Provider 的回复生成与 Token 估算。
 * 仅用于 Phase 1 演示模式；Phase 2 由真实网关响应替换。
 */

/** 本地 Token 估算：约 4 字符 1 token（与常见 BPE 词表的经验值一致） */
export function estimateTokens(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return Math.max(1, Math.ceil(trimmed.length / 4))
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text
          return typeof text === "string" ? text : ""
        }
        return ""
      })
      .join("")
  }
  return ""
}

/** 从 UIMessage 列表中提取最后一条用户消息文本 */
export function extractLastUserText(
  messages: Array<{ role: string; content?: unknown; parts?: unknown }>,
): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    if (message?.role !== "user") continue
    const fromParts = Array.isArray(message.parts)
      ? message.parts
          .map((part) =>
            part && typeof part === "object" && part.type === "text"
              ? String((part as { text?: unknown }).text ?? "")
              : "",
          )
          .join("")
      : ""
    const text = fromParts || extractText(message.content)
    if (text.trim()) return text
  }
  return ""
}

/** 生成确定性的 Mock 回复；内容自述演示属性，避免被误认为真实模型输出 */
export function buildMockReply(prompt: string, model: ComputeModel): string {
  const snippet = prompt.trim().slice(0, 60) || "（空输入）"
  return [
    `【Mock 响应 · 非真实模型输出】`,
    ``,
    `你正在通过 Coolha 算力市场 Playground（演示模式）与「${model.name}」对话。`,
    `该模型为演示目录中的虚构条目（数据来源：示例数据），本次回复由 Mock Provider 生成，未调用任何真实上游模型。`,
    ``,
    `你的输入前 60 字符：${snippet}`,
    ``,
    `本次调用的 Token 数与费用为本地估算值（约 4 字符/token），不代表真实计费。`,
    `Phase 2 接入 Vercel AI Gateway 后，此处将返回真实模型输出与上游用量数据。`,
  ].join("\n")
}

/** 将回复切分为适合流式展示的小块 */
export function chunkText(text: string, size = 12): string[] {
  const chunks: string[] = []
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size))
  }
  return chunks
}
