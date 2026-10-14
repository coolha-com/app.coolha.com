"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useChat } from "@ai-sdk/react"
import {
  RiRefreshLine,
  RiStopLine,
  RiDeleteBinLine,
  RiSendPlaneLine,
  RiGiftLine,
} from "react-icons/ri"
import type { ComputePlaygroundMeta } from "@/lib/compute/types"
import { formatUsd } from "@/lib/compute/service"
import { isFreeModel, type PlaygroundModel } from "@/lib/ai-gateway/playground"
import { CopyButton } from "./CopyButton"
import { ProviderLogo } from "./ProviderLogo"
import { cn } from "@/lib/utils"

type PlaygroundMessage = UIMessage<unknown, { "compute-meta": ComputePlaygroundMeta }>

/**
 * Playground 对话组件：向 Vercel AI Gateway 发起真实推理。
 * 同时渲染文本与推理（reasoning）分片，右侧面板展示真实 Token / 成本 / 实际供应商。
 */
export function PlaygroundChat({
  models,
  defaultSlug,
}: {
  models: PlaygroundModel[]
  defaultSlug: string | null
}) {
  const [modelId, setModelId] = useState(defaultSlug ?? models[0]?.id ?? "")
  const [meta, setMeta] = useState<ComputePlaygroundMeta | null>(null)
  const [input, setInput] = useState("")
  const scrollAnchor = useRef<HTMLDivElement>(null)

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/compute/playground" }), [])

  const { messages, sendMessage, stop, regenerate, setMessages, status, error } =
    useChat<PlaygroundMessage>({
      transport,
      onData: (part) => {
        if (part.type === "data-compute-meta") {
          setMeta(part.data)
        }
      },
    })

  const busy = status === "submitted" || status === "streaming"
  const selectedModel = models.find((model) => model.id === modelId) ?? models[0]
  const freeModels = useMemo(() => models.filter(isFreeModel), [models])
  const paidModels = useMemo(() => models.filter((model) => !isFreeModel(model)), [models])

  useEffect(() => {
    scrollAnchor.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages])

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const text = input.trim()
    if (!text || busy || !selectedModel) return
    setMeta(null)
    void sendMessage({ text }, { body: { model: selectedModel.id } })
    setInput("")
  }

  const onClear = () => {
    stop()
    setMessages([])
    setMeta(null)
  }

  const apiExample = `curl https://ai-gateway.vercel.sh/v1/chat/completions \\
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${selectedModel?.modelId ?? "provider/model-id"}",
    "messages": [
      {"role": "user", "content": "Hello"}
    ],
    "stream": false
  }'`

  if (models.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        目录不可用，暂无可测试的模型。请确认 AI Gateway 配置后重试。
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <section className="flex min-h-[32rem] flex-col rounded-2xl border bg-card shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <label htmlFor="playground-model" className="text-sm text-muted-foreground">
              模型
            </label>
            {selectedModel ? (
              <ProviderLogo
                providerId={selectedModel.providerId}
                providerName={selectedModel.providerName}
                size={20}
              />
            ) : null}
            <select
              id="playground-model"
              value={modelId}
              onChange={(event) => setModelId(event.target.value)}
              disabled={busy}
              className="h-9 max-w-[16rem] rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
            >
              {freeModels.length > 0 ? (
                <optgroup label="免费模型">
                  {freeModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}（{model.modelId}）
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {paidModels.length > 0 ? (
                <optgroup label="按量计费模型">
                  {paidModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}（{model.modelId}）
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
            {selectedModel && isFreeModel(selectedModel) ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <RiGiftLine className="size-3" />
                免费
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => regenerate()}
              disabled={busy || messages.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <RiRefreshLine className="size-3.5" />
              重新生成
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={busy || messages.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <RiDeleteBinLine className="size-3.5" />
              清空
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-48 items-center justify-center text-center text-sm text-muted-foreground">
              选择模型并输入提示词，开始真实推理。默认模型为上游免费模型，不产生调用成本。
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] space-y-2 rounded-2xl px-4 py-3 text-sm leading-6",
                    message.role === "user"
                      ? "bg-primary/15 text-foreground"
                      : "border bg-background",
                  )}
                >
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return (
                        <p key={index} className="whitespace-pre-wrap">
                          {part.text}
                        </p>
                      )
                    }
                    if (part.type === "reasoning") {
                      return (
                        <details key={index} className="rounded-lg bg-muted/50 px-3 py-2">
                          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                            推理过程
                          </summary>
                          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                            {part.text}
                          </p>
                        </details>
                      )
                    }
                    return null
                  })}
                </div>
              </div>
            ))
          )}
          <div ref={scrollAnchor} />
        </div>

        {error ? (
          <div className="mx-4 mb-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            调用失败：{error.message}
            {meta?.requestId ? `（Request ID: ${meta.requestId}）` : ""}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="flex items-end gap-2 border-t p-3">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                event.currentTarget.form?.requestSubmit()
              }
            }}
            rows={2}
            placeholder="输入提示词，Enter 发送，Shift+Enter 换行"
            aria-label="提示词输入"
            className="max-h-40 min-h-11 w-full resize-y rounded-xl border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => stop()}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              <RiStopLine className="size-4" />
              停止
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              <RiSendPlaneLine className="size-4" />
              发送
            </button>
          )}
        </form>
      </section>

      <aside className="space-y-4">
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">本次调用</h2>
            {meta ? (
              <span className="text-xs text-muted-foreground">
                {meta.mode === "live" ? "真实调用" : "演示"}
              </span>
            ) : null}
          </div>
          {meta ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Request ID</dt>
                <dd className="truncate font-mono text-xs">{meta.requestId}</dd>
              </div>
              {meta.generationId ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Generation</dt>
                  <dd className="truncate font-mono text-xs">{meta.generationId}</dd>
                </div>
              ) : null}
              {meta.resolvedProvider ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">实际供应商</dt>
                  <dd className="text-xs font-medium">{meta.resolvedProvider}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">输入 Token</dt>
                <dd className="font-medium tabular-nums">
                  {meta.inputTokens.toLocaleString("en-US")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">输出 Token</dt>
                <dd className="font-medium tabular-nums">
                  {meta.outputTokens.toLocaleString("en-US")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">耗时</dt>
                <dd className="font-medium tabular-nums">{(meta.latencyMs / 1000).toFixed(2)}s</dd>
              </div>
              <div className="flex justify-between border-t pt-2">
                <dt className="text-muted-foreground">
                  成本{meta.estimated ? "（估算）" : "（真实）"}
                </dt>
                <dd className="font-semibold tabular-nums text-primary">
                  {formatUsd(meta.costUsd)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              发送消息后显示 Request ID、实际供应商、Token 用量与真实成本。
            </p>
          )}
        </section>

        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">API 调用示例</h2>
            <CopyButton text={apiExample} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            示例直连 Vercel AI Gateway 官方端点，需使用你自己的 AI Gateway Key。Coolha 的
            Playground 仅用于体验模型能力，不提供 token 中转或转售。
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-muted p-3 text-xs leading-5">
            <code>{apiExample}</code>
          </pre>
        </section>
      </aside>
    </div>
  )
}
