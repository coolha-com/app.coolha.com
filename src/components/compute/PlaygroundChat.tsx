"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useChat } from "@ai-sdk/react"
import {
  RiAddLine,
  RiAttachmentLine,
  RiBrainLine,
  RiCloseLine,
  RiCloudLine,
  RiCloudOffLine,
  RiDeleteBinLine,
  RiHistoryLine,
  RiLineChartLine,
  RiRefreshLine,
  RiSendPlaneLine,
  RiShieldKeyholeLine,
  RiStopLine,
  RiStore2Line,
} from "react-icons/ri"
import { TbCoins } from "react-icons/tb"
import type { ComputePlaygroundMeta } from "@/lib/compute/types"
import type { PlaygroundModel } from "@/lib/ai-gateway/shared"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { useConnections } from "@/lib/compute/connections"
import { streamCustomModel, type ByokUsage } from "@/lib/compute/byok-client"
import {
  newId,
  type ByokHistoryMessage,
} from "@/lib/compute/thread-store"
import {
  clearCloudHistory,
  createCloudThread,
  deleteCloudThread,
  refreshCloudThreads,
  saveCloudMessages,
  toCloudMessages,
  useCloudThreads,
} from "@/lib/compute/cloud-threads"
import {
  loadThread,
  markThreadSynced,
  removeThread,
  saveThread,
  useThreadStore,
  type ThreadSummary,
} from "@/lib/compute/thread-store"
import type { LocalMessage } from "@/lib/compute/local-db"
import {
  connModelOf,
  isConnKey,
  ModelSelector,
} from "@/components/ai-elements/model-selector"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

type PlaygroundMessage = UIMessage<unknown, { "compute-meta": ComputePlaygroundMeta }>

interface Attachment {
  id: string
  name: string
  dataUrl: string
  mediaType: string
}

const DEEP_THINK_PROMPT =
  "请先进行深入分析：拆解问题、评估可行方案与风险，再逐步推理，最后给出结论清晰的最终答案。"

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error(`读取 ${file.name} 失败`))
    reader.readAsDataURL(file)
  })
}

/** 附件压缩：长边 ≤1600px、JPEG 0.85（单图通常 200-400KB） */
async function compressImage(file: File): Promise<{ dataUrl: string; mediaType: string }> {
  const raw = await readFileAsDataURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error("图片解析失败"))
      element.src = raw
    })
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height))
    const width = Math.round(image.width * scale)
    const height = Math.round(image.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) return { dataUrl: raw, mediaType: file.type }
    context.drawImage(image, 0, 0, width, height)
    const compressed = canvas.toDataURL("image/jpeg", 0.85)
    return compressed.length < raw.length
      ? { dataUrl: compressed, mediaType: "image/jpeg" }
      : { dataUrl: raw, mediaType: file.type }
  } catch {
    return { dataUrl: raw, mediaType: file.type }
  }
}

/** 历史抽屉里的统一条目：永远来自本地 IndexedDB（本地优先） */
interface HistoryEntry {
  id: string
  title: string
  updatedAt: number
  syncState: ThreadSummary["syncState"]
}

/** 双通道消息 → 本地存储格式（图片 dataUrl 已在此前被压缩/剥离，不落库） */
function toLocalMessages(
  threadId: string,
  modelKey: string,
  gateway: UIMessage[],
  byok: ByokHistoryMessage[],
): LocalMessage[] {
  const byokChannel = modelKey.startsWith("conn:")
  const out: LocalMessage[] = []
  if (byokChannel) {
    byok.forEach((message, index) => {
      const text = message.error ?? message.text
      out.push({
        id: `${threadId}-b${index}`,
        threadId,
        seq: index,
        role: message.role === "assistant" ? "assistant" : "user",
        parts: [{ type: "text", text }],
        text,
        modelKey,
        source: "byok",
        inputTokens: 0,
        outputTokens: 0,
        createdAt: Date.now() + index,
      })
    })
    return out
  }
  gateway.forEach((message, index) => {
    const text = message.parts
      .map((part) => (part.type === "text" ? part.text : part.type === "file" ? "[附件]" : ""))
      .join("")
      .trim()
    out.push({
      id: `${threadId}-g${index}`,
      threadId,
      seq: index,
      role: message.role === "assistant" ? "assistant" : "user",
      parts: [{ type: "text", text }],
      text,
      modelKey,
      source: "gateway",
      inputTokens: 0,
      outputTokens: 0,
      createdAt: Date.now() + index,
    })
  })
  return out
}

/** 本地存储 → 双通道消息（还原进 Chat） */
function localToChat(messages: LocalMessage[]): {
  gatewayMessages: UIMessage[]
  byokMessages: ByokHistoryMessage[]
} {
  const gatewayMessages: UIMessage[] = []
  const byokMessages: ByokHistoryMessage[] = []
  messages.forEach((message) => {
    if (message.source === "byok") {
      if (message.role === "system") return
      byokMessages.push({
        id: message.id,
        role: message.role === "assistant" ? "assistant" : "user",
        text: message.text,
      })
      return
    }
    gatewayMessages.push({
      id: message.id,
      role: message.role === "assistant" ? "assistant" : "user",
      parts: (message.parts?.length
        ? message.parts
        : [{ type: "text", text: message.text }]) as UIMessage["parts"],
    })
  })
  return { gatewayMessages, byokMessages }
}

/** 从 URL 读取 ?model=<slug>，用于模型广场跳转后预选模型 */
function readRequestedModelSlug(): string | null {
  if (typeof window === "undefined") return null
  try {
    const value = new URLSearchParams(window.location.search).get("model")
    return value && value.trim() ? value.trim() : null
  } catch {
    return null
  }
}

/**
 * Chat：全高 AI 对话工作台。
 *
 * 两条推理通道：赞助模型（服务端代理 Gateway，硬门禁只放行 ZDR+不训练模型）/
 * 自带连接（浏览器直连，不经过我们）。
 *
 * 存储是**本地优先**：IndexedDB 是唯一读源，云端只是可选镜像（见 thread-store.ts）。
 */
export function PlaygroundChat({
  models,
  defaultSlug,
}: {
  models: PlaygroundModel[]
  defaultSlug: string | null
}) {
  const connections = useConnections()
  const store = useThreadStore()
  const cloud = useCloudThreads()
  // 赞助模型由 Coolha 出钱，需签名登录；BYOK 走浏览器直连，不受此限制
  const { signedIn, isConnected, signIn } = useWalletAuth()

  /**
   * 初始模型：优先读 URL 上的 ?model=<slug>（模型广场「在 Chat 中对话」入口带过来），
   * 否则用服务端给的默认模型。只在挂载时求值一次，不随 URL 变化重置。
   */
  const [modelKey, setModelKey] = useState(() => {
    const requested = readRequestedModelSlug()
    const matched = requested
      ? models.find((item) => item.id === requested || item.modelId === requested)
      : undefined
    return `free:${matched?.id ?? defaultSlug ?? models[0]?.id ?? ""}`
  })
  const [conversationId, setConversationId] = useState(() => newId())
  const [deepThinking, setDeepThinking] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [input, setInput] = useState("")
  const [byokMessages, setByokMessages] = useState<ByokHistoryMessage[]>([])
  const [byokBusy, setByokBusy] = useState(false)
  const [byokError, setByokError] = useState<string | null>(null)
  const [byokUsage, setByokUsage] = useState<ByokUsage | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const scrollAnchor = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController>(null)

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/compute/playground",
        fetch: async (input, init) => {
          const response = await fetch(input, init)
          if (!response.ok) {
            const raw = await response.text()
            let message = raw
            try {
              const parsed = JSON.parse(raw) as { error?: { message?: string } }
              if (parsed?.error?.message) message = parsed.error.message
            } catch {
              // 非 JSON 响应，保留原文
            }
            throw new Error(message || `请求失败（${response.status}）`)
          }
          return response
        },
      }),
    [],
  )

  const { messages, sendMessage, stop, regenerate, setMessages, status, error } =
    useChat<PlaygroundMessage>({ transport })

  const gatewayBusy = status === "submitted" || status === "streaming"
  const busy = gatewayBusy || byokBusy

  /**
   * models 已是服务端筛好的「Coolha 赞助」集合（零数据保留 + 不用于训练 + 非 stealth），
   * 这里不再做二次过滤——按价格 0 判免费会把它们全部误杀。
   */
  const sponsoredModels = models
  const isConn = isConnKey(modelKey)
  const selectedModel = isConn
    ? undefined
    : (models.find((model) => model.id === modelKey.replace("free:", "")) ?? sponsoredModels[0])
  const selectedConnection = isConn
    ? connections.find((item) => modelKey.startsWith(`conn:${item.id}:`))
    : undefined
  const selectedConnModel = selectedConnection ? connModelOf(modelKey, selectedConnection.id) : ""
  const supportsReasoning = Boolean(selectedModel?.tags?.includes("reasoning"))
  /** 当前选的是免费模型但未签名登录 → 拦截发送并给出登录入口 */
  const needsSignIn = !isConn && !signedIn

  // 对话历史自动落盘到本地 IndexedDB（本地优先：这是唯一读源，任何模式都写）
  useEffect(() => {
    if (!store.ready) return
    if (messages.length === 0 && byokMessages.length === 0) return
    void saveThread({
      id: conversationId,
      modelKey,
      messages: toLocalMessages(conversationId, modelKey, messages, byokMessages),
    })
  }, [store.ready, messages, byokMessages, conversationId, modelKey])

  /**
   * 云端镜像（可选）：仅当用户在设置里打开「云端备份」、且档位含云历史时，
   * 才在本地写完后后台推一份。本地失败/云端失败都不影响对话本身。
   */
  const pushKeyRef = useRef("")
  const backupEnabled = store.mode === "backup" && cloud.status === "ready"
  useEffect(() => {
    if (!backupEnabled) return
    if (busy) return
    const payload = toCloudMessages({ modelKey, gatewayMessages: messages, byokMessages })
    if (payload.length === 0) return
    const key = `${conversationId}|${modelKey}|${payload.length}`
    if (pushKeyRef.current === key) return
    pushKeyRef.current = key
    void (async () => {
      const known = cloud.threads.some((thread) => thread.id === conversationId)
      if (!known) {
        const created = await createCloudThread({
          id: conversationId,
          title: payload[0]?.text?.slice(0, 24) || "新对话",
          modelKey,
        })
        if (!created.id) return
      }
      await saveCloudMessages(conversationId, { messages: payload, modelKey })
      await refreshCloudThreads()
    })()
  }, [backupEnabled, busy, cloud.status, cloud.threads, conversationId, modelKey, messages, byokMessages])

  useEffect(() => {
    scrollAnchor.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, byokMessages])

  useEffect(() => () => abortRef.current?.abort(), [])

  const startNewConversation = useCallback(() => {
    abortRef.current?.abort()
    stop()
    setMessages([])
    setByokMessages([])
    setByokError(null)
    setByokUsage(null)
    setAttachments([])
    setLocalError(null)
    setConversationId(newId())
    setHistoryOpen(false)
    pushKeyRef.current = ""
  }, [setMessages, stop])

  /** 历史列表：永远来自本地 IndexedDB（本地优先，不依赖云端可用性） */
  const historyEntries = useMemo<HistoryEntry[]>(
    () =>
      store.threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        updatedAt: thread.updatedAt,
        syncState: thread.syncState,
      })),
    [store.threads],
  )

  const openHistoryEntry = useCallback(
    (entry: HistoryEntry) => {
      void (async () => {
        const detail = await loadThread(entry.id)
        if (!detail) {
          setLocalError("读取本地会话失败，请重试")
          return
        }
        const restored = localToChat(detail.messages)
        abortRef.current?.abort()
        stop()
        setMessages(restored.gatewayMessages as PlaygroundMessage[])
        setByokMessages(restored.byokMessages)
        if (detail.thread.modelKey) setModelKey(detail.thread.modelKey)
        setConversationId(entry.id)
        pushKeyRef.current = `${entry.id}|${detail.thread.modelKey}|${detail.messages.length}`
        setHistoryOpen(false)
      })()
    },
    [setMessages, stop],
  )

  const removeHistoryEntry = useCallback(
    (entry: HistoryEntry) => {
      void (async () => {
        await removeThread(entry.id)
        // 备份模式下同步删云端，避免恢复时又冒出来
        if (backupEnabled) await deleteCloudThread(entry.id)
        if (entry.id === conversationId) startNewConversation()
      })()
    },
    [backupEnabled, conversationId, startNewConversation],
  )

  const onClearCloudHistory = useCallback(() => {
    void (async () => {
      const result = await clearCloudHistory()
      if (!result.ok) {
        setLocalError(result.message ?? "清空云端备份失败")
        return
      }
      // 云端清空后，本地会话需重新标记为待同步，否则不会再次上传
      pushKeyRef.current = ""
      for (const thread of store.threads) await markThreadSynced(thread.id)
      startNewConversation()
    })
  }, [startNewConversation, store.threads])

  const onPickFiles = async (files: FileList | null) => {
    if (!files) return
    const next: Attachment[] = []
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue
      if (file.size > 12 * 1024 * 1024) {
        setLocalError(`图片 ${file.name} 超过 12MB，请压缩后再试`)
        continue
      }
      setCompressing(true)
      try {
        const { dataUrl, mediaType } = await compressImage(file)
        next.push({ id: newId(), name: file.name, dataUrl, mediaType })
      } catch (err) {
        setLocalError(err instanceof Error ? err.message : "读取图片失败")
      } finally {
        setCompressing(false)
      }
    }
    if (next.length > 0) setAttachments((prev) => [...prev, ...next])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const sendByok = async (text: string, images: Attachment[]) => {
    const connection = selectedConnection
    if (!connection) return

    const history = byokMessages.map((item) => ({ role: item.role, content: item.text }))
    const content: Array<
      { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
    > = []
    if (deepThinking) content.push({ type: "text", text: DEEP_THINK_PROMPT })
    content.push({ type: "text", text })
    for (const image of images) {
      content.push({ type: "image_url", image_url: { url: image.dataUrl } })
    }

    const replyId = newId()
    setByokMessages((prev) => [
      ...prev,
      {
        id: newId(),
        role: "user",
        text: [text, ...images.map((image) => `[图片] ${image.name}`)].join("\n"),
      },
      { id: replyId, role: "assistant", text: "" },
    ])
    setInput("")
    setAttachments([])
    setByokError(null)
    setByokUsage(null)
    setByokBusy(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await streamCustomModel({
        baseURL: connection.baseURL,
        apiKey: connection.apiKey,
        model: selectedConnModel,
        messages: [...history, { role: "user", content }],
        signal: controller.signal,
        onDelta: (delta) =>
          setByokMessages((prev) =>
            prev.map((item) => (item.id === replyId ? { ...item, text: item.text + delta } : item)),
          ),
        onDone: (usage) => setByokUsage(usage),
      })
    } catch (err) {
      if (controller.signal.aborted) return
      const message = err instanceof Error ? err.message : "未知错误"
      setByokError(message)
      setByokMessages((prev) =>
        prev.map((item) => (item.id === replyId ? { ...item, error: message } : item)),
      )
    } finally {
      setByokBusy(false)
      abortRef.current = null
    }
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const text = input.trim()
    if (!text || busy) return
    setLocalError(null)
    if (isConn) {
      if (selectedConnection && selectedConnModel) void sendByok(text, attachments)
      return
    }
    if (!selectedModel) return
    if (!signedIn) {
      setLocalError("免费模型需要先签名登录。你也可以添加自己的模型与 API Key 直接对话。")
      return
    }
    void sendMessage(
      {
        text: deepThinking ? `${DEEP_THINK_PROMPT}\n\n${text}` : text,
        files: attachments.map((image) => ({
          type: "file" as const,
          mediaType: image.mediaType,
          url: image.dataUrl,
        })),
      },
      { body: { model: selectedModel.id } },
    )
    setInput("")
    setAttachments([])
  }

  const hasConversation = isConn ? byokMessages.length > 0 : messages.length > 0
  const suggestions = [
    "帮我写一段产品发布文案",
    "解释一下 ERC-4337 是什么",
    "把这个需求拆成开发任务",
  ]

  return (
    <section className="relative flex min-h-0 flex-1 flex-col">
      {/* 会话历史抽屉 */}
      {historyOpen ? (
        <div className="absolute inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col border-r bg-background shadow-xl">
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <span className="text-sm font-medium">对话历史</span>
            <button
              type="button"
              onClick={() => setHistoryOpen(false)}
              className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
              aria-label="关闭历史"
            >
              <RiCloseLine className="size-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <button
              type="button"
              onClick={startNewConversation}
              className="mb-2 flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors hover:bg-accent"
            >
              <RiAddLine className="size-4" />
              新对话
            </button>
            {historyEntries.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs text-muted-foreground">
                还没有历史对话
              </p>
            ) : (
              <ul className="space-y-0.5">
                {historyEntries.map((entry) => (
                  <li key={entry.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openHistoryEntry(entry)}
                      className={cn(
                        "min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent",
                        entry.id === conversationId && "bg-accent",
                      )}
                    >
                      <span className="block truncate">{entry.title}</span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {entry.syncState === "synced" ? (
                          <RiCloudLine className="size-3" aria-label="已备份到云端" />
                        ) : entry.syncState === "pending" ? (
                          <RiCloudOffLine className="size-3" aria-label="仅本地" />
                        ) : null}
                        {new Date(entry.updatedAt).toLocaleString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeHistoryEntry(entry)}
                      aria-label={`删除对话 ${entry.title}`}
                      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <RiDeleteBinLine className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t px-3 py-2.5">
            {!store.dbAvailable ? (
              <p className="text-[11px] leading-4 text-destructive">
                浏览器存储不可用（隐私模式或空间不足），本次对话不会被保存。
              </p>
            ) : store.mode === "backup" ? (
              cloud.status === "ready" ? (
                <>
                  <p className="text-[11px] leading-4 text-muted-foreground">
                    本地优先：对话保存在本机，云端备份已开启（{cloud.plan} 档）。
                    API Key 永不上传，服务端只保存对话正文。
                  </p>
                  <button
                    type="button"
                    onClick={onClearCloudHistory}
                    className="mt-2 w-full rounded-lg border border-destructive/40 px-2 py-1.5 text-[11px] text-destructive transition-colors hover:bg-destructive/10"
                  >
                    清空云端备份
                  </button>
                </>
              ) : cloud.status === "anonymous" ? (
                <p className="text-[11px] leading-4 text-muted-foreground">
                  本地优先：对话只保存在本机。签名登录并订阅后可开启云端备份。
                </p>
              ) : (
                <p className="text-[11px] leading-4 text-muted-foreground">
                  本地优先：对话只保存在本机。当前档位不含云端备份，升级 Plus 起可开启。
                </p>
              )
            ) : (
              <p className="text-[11px] leading-4 text-muted-foreground">
                <strong className="font-medium text-foreground">本地优先</strong>
                ：对话只保存在这台设备的浏览器里，不上传、不同步。可在设置中开启云端备份。
              </p>
            )}
            <a
              href="/settings"
              className="mt-2 inline-block text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              设置与隐私
            </a>
          </div>
        </div>
      ) : null}
      {historyOpen ? (
        <button
          type="button"
          aria-label="关闭历史"
          onClick={() => setHistoryOpen(false)}
          className="absolute inset-0 z-30 bg-black/40 lg:hidden"
        />
      ) : null}

      <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            title="对话历史"
            aria-label="对话历史"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RiHistoryLine className="size-4" />
          </button>
          <button
            type="button"
            onClick={startNewConversation}
            title="新对话"
            aria-label="新对话"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <RiAddLine className="size-4" />
          </button>
          <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
          <nav aria-label="数据" className="flex shrink-0 items-center gap-0.5">
            <ModuleLink href="/ai/usage" icon={RiLineChartLine} label="用量记录" />
            <ModuleLink href="/ai/billing" icon={TbCoins} label="余额与账单" />
          </nav>
          <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />
          <ModelSelector
            freeModels={sponsoredModels}
            connections={connections}
            modelKey={modelKey}
            disabled={busy}
            signedIn={signedIn}
            onChange={(key) => {
              setModelKey(key)
              setByokError(null)
              setByokUsage(null)
            }}
          />
        </div>
      </header>

      {deepThinking && selectedModel && !supportsReasoning ? (
        <p className="border-b bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground">
          当前免费模型不返回推理过程，将直接输出最终答案。
        </p>
      ) : null}

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-3xl space-y-5">
          {!hasConversation ? (
            <div className="flex flex-col items-center gap-4 pt-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <RiSendPlaneLine className="size-5" />
              </div>
              <p className="text-lg font-medium">今天想聊点什么？</p>
              <div className="flex flex-wrap justify-center gap-2">
                {suggestions.map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => setInput(text)}
                    className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          ) : isConn ? (
            byokMessages.map((item) => (
              <Bubble key={item.id} role={item.role} text={item.text} error={item.error} />
            ))
          ) : (
            messages.map((message, index) => (
              <Bubble
                key={message.id}
                role={message.role}
                text={message.parts
                  .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
                  .map((part) => part.text)
                  .join("")}
                reasoning={
                  message.parts.find((part) => part.type === "reasoning")?.text as string | undefined
                }
                onRegenerate={
                  message.role === "assistant" && index === messages.length - 1 && !busy
                    ? () => regenerate()
                    : undefined
                }
              />
            ))
          )}
          <div ref={scrollAnchor} />
        </div>
      </div>

      {localError ? <ErrorBar text={localError} /> : null}
      {isConn && byokError ? <ErrorBar text={byokError} /> : null}
      {!isConn && error ? <ErrorBar text={error.message} /> : null}

      {needsSignIn ? (
        <div className="border-t bg-background/95 px-4 py-2 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-xl border border-dashed px-3 py-2">
            <RiShieldKeyholeLine className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              免费模型需签名登录 · 每日额度全档位统一，订阅不增加
            </span>
            <button
              type="button"
              onClick={() => void signIn()}
              disabled={!isConnected}
              title={isConnected ? "签名登录" : "请先在侧边栏连接钱包"}
              className="shrink-0 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isConnected ? "签名登录" : "请先连接钱包"}
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl">
          {attachments.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((image) => (
                <span
                  key={image.id}
                  className="relative inline-flex items-center gap-2 rounded-xl border bg-muted/50 py-1 pl-1 pr-7 text-xs"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.dataUrl} alt={image.name} className="size-8 rounded-lg object-cover" />
                  <span className="max-w-[10rem] truncate">{image.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((item) => item.id !== image.id))}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-accent"
                    aria-label={`移除 ${image.name}`}
                  >
                    <RiCloseLine className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          {/* AI Elements「Prompt Input」结构：InputGroup + block-end 工具行 */}
          <InputGroup className="rounded-2xl">
            <InputGroupTextarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              rows={1}
              placeholder={
                isConn && !selectedConnModel
                  ? "请先在「API 连接」中为该连接填写模型 ID"
                  : "输入消息，Enter 发送，Shift+Enter 换行"
              }
              aria-label="消息输入"
              className="max-h-40 min-h-11 flex-1 resize-none px-3 py-2.5"
            />
            <InputGroupAddon align="block-end">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => void onPickFiles(event.target.files)}
              />
              <InputGroupButton
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy || compressing}
                title={compressing ? "正在压缩图片" : "添加图片"}
                aria-label="添加图片"
              >
                {compressing ? <Spinner /> : <RiAttachmentLine />}
              </InputGroupButton>
              <InputGroupButton
                type="button"
                size="icon-sm"
                variant={deepThinking ? "secondary" : "ghost"}
                onClick={() => setDeepThinking((prev) => !prev)}
                disabled={busy}
                aria-pressed={deepThinking}
                title="深度思考：先分析再作答"
                aria-label="深度思考"
                className={cn(deepThinking && "text-primary")}
              >
                <RiBrainLine />
              </InputGroupButton>
              {busy ? (
                <InputGroupButton
                  type="button"
                  size="icon-sm"
                  variant="default"
                  className="ml-auto rounded-full"
                  onClick={() => {
                    abortRef.current?.abort()
                    stop()
                  }}
                  title="停止生成"
                  aria-label="停止生成"
                >
                  <RiStopLine />
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  variant="default"
                  className="ml-auto rounded-full"
                  disabled={!input.trim() || (isConn && !selectedConnModel)}
                  title="发送"
                  aria-label="发送"
                >
                  <RiSendPlaneLine />
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>

          {isConn && selectedConnection ? (
            <p className="mt-1.5 px-1 text-[11px] leading-4 text-muted-foreground">
              由你的 {selectedConnection.name} 直连 · 密钥仅存本浏览器 ·{" "}
              {byokUsage?.inputTokens != null
                ? `本次 ${byokUsage.inputTokens}/${byokUsage.outputTokens ?? 0} tokens`
                : "费用由你的账户承担"}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  )
}

function ErrorBar({ text }: { text: string }) {
  return (
    <p className="mx-4 mb-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      {text}
    </p>
  )
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 animate-spin" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" strokeLinecap="round" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </svg>
  )
}

function ModuleLink({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: typeof RiStore2Line
  label: string
}) {
  return (
    <a
      href={href}
      title={label}
      aria-label={label}
      className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon className="size-4" />
    </a>
  )
}

function Bubble({
  role,
  text,
  reasoning,
  error,
  onRegenerate,
}: {
  role: "user" | "assistant" | "system"
  text: string
  reasoning?: string
  error?: string
  onRegenerate?: () => void
}) {
  const isUser = role === "user"
  return (
    <div className={cn("group flex gap-3", isUser && "justify-end")}>
      {!isUser ? (
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          C
        </span>
      ) : null}
      <div
        className={cn(
          "max-w-[85%] space-y-2 rounded-2xl px-4 py-2.5 text-sm leading-7",
          isUser ? "bg-primary/15 text-foreground" : "bg-muted/50 text-foreground",
        )}
      >
        {reasoning ? (
          <details className="rounded-xl bg-background/60 px-3 py-2 text-xs">
            <summary className="cursor-pointer font-medium text-muted-foreground">思考过程</summary>
            <p className="mt-2 whitespace-pre-wrap leading-5 text-muted-foreground">{reasoning}</p>
          </details>
        ) : null}
        {text ? <p className="whitespace-pre-wrap">{text}</p> : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        {onRegenerate ? (
          <div className="flex justify-end pt-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <button
              type="button"
              onClick={onRegenerate}
              title="重新生成"
              aria-label="重新生成"
              className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <RiRefreshLine className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
