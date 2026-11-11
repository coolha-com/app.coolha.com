import { RiAttachmentLine, RiBrainLine, RiTerminalBoxLine } from "react-icons/ri"

import { adaptEveParts } from "@/components/agents/eve-message-adapt"
import { MarkdownMessage } from "@/components/agents/MarkdownMessage"

function toolStateLabel(state: string): string {
  switch (state) {
    case "streaming":
      return "调用中"
    case "done":
    case "succeeded":
    case "complete":
      return "已完成"
    case "failed":
    case "error":
      return "失败"
    default:
      return state || "未知"
  }
}

function StructuredBlock({ value }: { value: unknown }) {
  let text = ""
  try {
    text = JSON.stringify(value, null, 2) ?? ""
  } catch {
    text = ""
  }
  if (!text) return <p className="text-xs text-muted-foreground">结构化结果未提供</p>
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-2xl bg-muted/60 p-3 text-xs leading-5">
      {text}
    </pre>
  )
}

export function EveMessageBody({
  parts,
  assistant,
}: {
  parts: unknown
  assistant?: boolean
}) {
  const display = adaptEveParts(parts)
  const texts = display.filter((part) => part.kind === "text")
  const reasoning = display.filter((part) => part.kind === "reasoning")
  const tools = display.filter((part) => part.kind === "tool")
  const files = display.filter((part) => part.kind === "file")
  const structured = display.filter((part) => part.kind === "structured")
  const unknown = display.filter((part) => part.kind === "unknown")

  return (
    <div className="space-y-3">
      {reasoning.length > 0 ? (
        <details className="rounded-3xl bg-muted/40 px-3 py-2 text-xs leading-5">
          <summary className="flex cursor-pointer items-center gap-1.5 font-medium">
            <RiBrainLine className="size-3.5" />
            思考过程 · {reasoning.length} 段
          </summary>
          <div className="mt-2 space-y-2 text-muted-foreground">
            {reasoning.map((part, index) =>
              part.kind === "reasoning" ? (
                <p key={index} className="whitespace-pre-wrap">
                  {part.text}
                </p>
              ) : null,
            )}
          </div>
        </details>
      ) : null}

      {tools.length > 0 ? (
        <details open className="rounded-3xl bg-muted/40 px-3 py-2 text-xs leading-5">
          <summary className="flex cursor-pointer items-center gap-1.5 font-medium">
            <RiTerminalBoxLine className="size-3.5" />
            执行过程 · {tools.length} 步
          </summary>
          <ol className="mt-2 space-y-2">
            {tools.map((part, index) =>
              part.kind === "tool" ? (
                <li key={part.callId ?? index} className="rounded-3xl bg-muted/50 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{part.name}</span>
                    <span className="text-muted-foreground">{toolStateLabel(part.state)}</span>
                  </div>
                  {part.inputText ? (
                    <p className="mt-1 break-all text-muted-foreground">输入：{part.inputText}</p>
                  ) : null}
                  {part.output !== undefined ? (
                    <div className="mt-2">
                      <StructuredBlock value={part.output} />
                    </div>
                  ) : null}
                  {part.error ? (
                    <p className="mt-1 text-destructive">失败：{String(part.error)}</p>
                  ) : null}
                </li>
              ) : null,
            )}
          </ol>
        </details>
      ) : null}

      {texts.length > 0 ? (
        assistant ? (
          <MarkdownMessage content={texts.map((part) => (part.kind === "text" ? part.text : "")).join("\n\n")} />
        ) : (
          texts.map((part, index) =>
            part.kind === "text" ? (
              <p key={index} className="whitespace-pre-wrap">
                {part.text}
              </p>
            ) : null,
          )
        )
      ) : null}

      {structured.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">结构化结果</p>
          {structured.map((part, index) =>
            part.kind === "structured" ? <StructuredBlock key={index} value={part.value} /> : null,
          )}
        </div>
      ) : null}

      {files.length > 0 ? (
        <p className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          {files.map((part, index) =>
            part.kind === "file" ? (
              <span key={index} className="rounded-full border px-2 py-0.5">
                <RiAttachmentLine className="mr-1 inline size-3" />
                {part.filename}
              </span>
            ) : null,
          )}
        </p>
      ) : null}

      {unknown.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          未识别的消息片段：{unknown.map((part) => (part.kind === "unknown" ? part.type : "")).join("、")}
        </p>
      ) : null}
    </div>
  )
}
