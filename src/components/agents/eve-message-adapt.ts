/**
 * EVE MessagePart → 工作台展示结构。
 *
 * EVE 的消息 part 不是 AI SDK 的 UIMessage。这里只认 EVE 实际会出现的字段，
 * 未知类型单独展示，不把它们当成文本或工具结果。
 */

export type EveDisplayPart =
  | { kind: "text"; text: string }
  | { kind: "reasoning"; text: string }
  | { kind: "file"; filename: string }
  | {
      kind: "tool"
      name: string
      state: string
      inputText?: string
      output?: unknown
      error?: unknown
      callId?: string
    }
  | { kind: "structured"; value: unknown }
  | { kind: "unknown"; type: string }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function adaptEveParts(parts: unknown): EveDisplayPart[] {
  if (!Array.isArray(parts)) return []
  const out: EveDisplayPart[] = []
  for (const item of parts) {
    const part = asRecord(item)
    if (!part || typeof part.type !== "string") {
      out.push({ kind: "unknown", type: "invalid" })
      continue
    }
    if (part.type === "text") {
      out.push({ kind: "text", text: typeof part.text === "string" ? part.text : "" })
      continue
    }
    if (part.type === "reasoning") {
      out.push({ kind: "reasoning", text: typeof part.text === "string" ? part.text : "" })
      continue
    }
    if (part.type === "file") {
      out.push({
        kind: "file",
        filename: typeof part.filename === "string" && part.filename ? part.filename : "附件",
      })
      continue
    }
    if (part.type === "tool") {
      out.push({
        kind: "tool",
        name:
          typeof part.label === "string" && part.label
            ? part.label
            : typeof part.name === "string"
              ? part.name
              : "工具",
        state: typeof part.state === "string" ? part.state : "",
        inputText: typeof part.inputText === "string" ? part.inputText : undefined,
        output: "output" in part ? part.output : undefined,
        error: "error" in part ? part.error : undefined,
        callId: typeof part.callId === "string" ? part.callId : undefined,
      })
      continue
    }
    if (part.type === "data" || part.type === "json" || part.type === "structured") {
      out.push({ kind: "structured", value: "data" in part ? part.data : part })
      continue
    }
    out.push({ kind: "unknown", type: part.type })
  }
  return out
}
