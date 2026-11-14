"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useEveAgent } from "eve/react"
import { activity } from "eve/events"
import type { MessagePart } from "eve/client"
import {
  RiAddLine,
  RiArrowRightUpLine,
  RiAttachmentLine,
  RiCheckboxCircleLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiHistoryLine,
  RiRefreshLine,
  RiRobot2Line,
  RiShieldKeyholeLine,
} from "react-icons/ri"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ModelSelector } from "@/components/ai-elements/model-selector"
import { AgentSelector, type AgentOption } from "@/components/agents/AgentSelector"
import { AgentConfigPanel, type AgentConfigValue, type CreditsState } from "@/components/agents/AgentConfigPanel"
import { EveMessageBody } from "@/components/agents/eve-message-view"
import { useAuth } from "@/hooks/useAuth"
import type { PlaygroundModel } from "@/lib/ai-gateway/shared"

/**
 * Agent 执行通道（对话即任务）。
 *
 * 选中一个需要配置的智能体 → 先出现配置面板（模型 + 约束）→ 用户「开始任务」后才进入对话。
 * 对话的每一轮都会把 eve 的会话游标（session）与事件流（events）写入服务端 chat_sessions
 * 表（按登录用户隔离），「历史任务」列表从同一张表读取，点开即可续看/续聊。
 * 挂载时若 URL 带 ?session=<id>，则拉取该会话并以 resume 续接。
 *
 * 顶部工具栏（Agent 切换 / 模型切换 / 历史任务 / 新建任务）始终可见；
 * 主区在「配置面板」与「对话」之间切换。
 */

/** 需要强制约束配置的智能体（目前仅 RWA）。其余智能体走无约束配置面板。 */
const AGENTS_REQUIRING_CONSTRAINTS = new Set<string>(["coolha-rwa"])

const AGENTS: AgentOption[] = [
  {
    id: "coolha-rwa",
    name: "CoolhaRWAagent",
    subtitle: "RWA 尽调 Agent",
    live: true,
  },
  { id: "contract-audit", name: "Contract Audit", subtitle: "合约审查", live: false },
  { id: "defi-analytics", name: "DeFi Analytics", subtitle: "DeFi 分析", live: false },
]

interface Attachment {
  id: string
  name: string
  dataUrl: string
  mediaType: string
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error(`读取 ${file.name} 失败`))
    reader.readAsDataURL(file)
  })
}

/**
 * 错误如实分类：不把上游状态笼统说成「执行失败」，也不吞掉原文
 * （Vercel 的 request id 是联系支持时必须提供的凭证）。
 */
function describeAgentError(message: string): { title: string; detail: string } {
  if (/AGENT_RUNTIME_UNREACHABLE|Agent Runtime 暂不可用/i.test(message)) {
    return {
      title: "Agent 运行时未启动",
      detail: `本地 eve Runtime 未运行或连接已断开，请先启动 Runtime 再试。原文：${message}`,
    }
  }
  if (/AGENT_RUNTIME_NOT_CONFIGURED|Agent Runtime 未配置/i.test(message)) {
    return {
      title: "Agent 运行时未配置",
      detail: `当前环境未配置 EVE_RUNTIME_ORIGIN / EVE_INTERNAL_SECRET，服务尚未接入。原文：${message}`,
    }
  }
  if (/INFERENCE_NOT_CONFIGURED|统一推理网关|推理网关未接入/i.test(message)) {
    return {
      title: "推理网关未接入",
      detail: `平台尚未配置统一推理网关（INFERENCE_BASE_URL / INFERENCE_API_KEY / INFERENCE_MODELS）。配置后 Agent 即可派单，无需改代码。原文：${message}`,
    }
  }
  if (/team is blocked from using AI Gateway|account_blocked/i.test(message)) {
    return {
      title: "上游网关拒绝访问",
      detail: `所接推理网关返回 account_blocked（上游账号级限制，与本地代码无关）。请检查该厂商账号状态。原文：${message}`,
    }
  }
  if (/SIGN_IN_REQUIRED/i.test(message)) {
    return { title: "请先登入", detail: message }
  }
  if (/MODEL_NOT_ALLOWED/i.test(message)) {
    return { title: "模型不在白名单", detail: message }
  }
  if (/UPSTREAM_UNAUTHORIZED|401|403/i.test(message)) {
    return { title: "推理网关拒绝访问", detail: message }
  }
  if (/UPSTREAM_RATE_LIMITED|429/i.test(message)) {
    return { title: "推理网关限流", detail: message }
  }
  if (/UPSTREAM_UNAVAILABLE|502|503/i.test(message)) {
    return { title: "推理网关或运行时不可用", detail: message }
  }
  if (/QUOTA_EXHAUSTED|BUDGET_UNAVAILABLE|PAYMENT_REQUIRED|GRANT_EXPIRED/i.test(message)) {
    return { title: "当前不能执行", detail: message }
  }
  return { title: "Agent 执行失败", detail: message }
}

// ── 从消息里抽取标题 / 预览文本 ────────────────────────────────────────────────

interface RawMessage {
  id: string
  role: string
  parts: { type: string; text?: string }[]
}

/**
 * eve 的 initialEvents 只有「事件带 meta.position、且 type 属于当前版本的
 * fact/progress 目录」时才可续接。旧版本（eve < 27）存的事件不满足，useEveAgent
 * 会在渲染期直接抛错，把整页带崩到 error boundary。
 * 所以续接前先自查：不可续接就退回「新会话 + 回看 transcript」，绝不崩页面。
 */
function canResumeEvents(events: unknown): boolean {
  if (!Array.isArray(events)) return false
  if (events.length === 0) return true
  return events.every((event) => {
    if (!event || typeof event !== "object") return false
    const e = event as { meta?: { position?: unknown }; type?: unknown }
    if (typeof e.meta?.position !== "number") return false
    // 目录里的事件类型都是 family.action 形式（如 content.completed）
    return typeof e.type === "string" && /^[a-z-]+\.[a-z-]+$/.test(e.type)
  })
}

function textOf(messages: RawMessage[]): string {
  for (const m of messages) {
    const t = m.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join(" ")
      .trim()
    if (t) return t
  }
  return ""
}

function firstUserText(messages: RawMessage[]): string {
  for (const m of messages) {
    if (m.role !== "user") continue
    const t = textOf([m])
    if (t) return t
  }
  return ""
}

// ── 会话持久化写入服务端 ───────────────────────────────────────────────────────

interface PersistPayload {
  session: unknown
  events: unknown[]
  transcript: RawMessage[]
  preview: string
  title: string
}

/**
 * 聊天会话主体：持有 useEveAgent 与消息渲染。
 * 由外层 AgentWorkspace 用 `${bootKey}:${sessionId}` 作为 key 挂载；sessionId 决定这是新会话还是续接已有会话。
 * 顶部工具栏已在外层统一渲染，这里只负责消息流与输入框。
 */
function ChatSession({
  agentId,
  modelId,
  sessionId,
  initialData,
  initialTranscript,
  onPersist,
}: {
  agentId: string
  modelId: string
  sessionId: string
  initialData: { session?: Record<string, unknown> | null; events?: unknown[] | null }
  initialTranscript: RawMessage[]
  onPersist: (payload: PersistPayload) => void
}) {
  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 模型随切换即时生效：headers 在 store 创建时只捕获一次，用 ref 让闭包始终读到最新值
  const modelRef = useRef(modelId)
  useEffect(() => {
    modelRef.current = modelId
  }, [modelId])

  // 续接前先自查存档能不能被当前 eve 版本读；不能就不传 initialEvents，
  // 否则 useEveAgent 会在渲染期抛错，把整页带崩。
  const resumable = Boolean(initialData?.session) && canResumeEvents(initialData?.events)
  const resumeSkipped = Boolean(initialData?.session) && !resumable

  const agent = useEveAgent({
    // 带上会话 id：受控代理据此把推理用量记到这次对话绑定的服务授权上
    headers: () => ({
      "x-coolha-eve-model": modelRef.current,
      "x-coolha-chat-session": sessionId,
    }),
    ...(resumable
      ? {
          resume: true,
          initialSession: initialData!.session as never,
          initialEvents: (initialData?.events ?? []) as never,
        }
      : {}),
  })

  // 会话变更后（debounce）写入服务端 chat_sessions
  useEffect(() => {
    const session = agent.session
    if (!session) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const live = agent.messages as unknown as RawMessage[]
      onPersist({
        session,
        events: (agent.events ?? []) as unknown[],
        // 我们自己投影一份对话记录：与 eve 版本无关，历史任务永远能回看
        transcript: live.map((m) => ({ id: m.id, role: m.role, parts: m.parts })),
        preview: textOf(live).slice(0, 140),
        title: firstUserText(live).slice(0, 60) || "新任务",
      })
    }, 600)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [agent.session, agent.events, agent.messages, onPersist])

  const busy = agent.status === "busy" || agent.status === "resuming"
  const selected = AGENTS.find((item) => item.id === agentId) ?? AGENTS[0]
  const describedError = agent.error
    ? describeAgentError(agent.error.message)
    : null

  const now = activity(agent.view)
  const activityLabel =
    now.kind === "calling"
      ? `正在调用 ${now.names.join("、")}`
      : now.kind === "waiting-on-tasks"
        ? "等待子任务完成"
        : now.kind === "compacting"
          ? "整理上下文"
          : "思考中"

  const canSend = selected.live && input.trim().length > 0 && !busy

  async function onFiles(list: FileList | null) {
    if (!list) return
    const next: Attachment[] = []
    for (const file of Array.from(list)) {
      try {
        next.push({
          id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          dataUrl: await readFileAsDataURL(file),
          mediaType: file.type || "application/octet-stream",
        })
      } catch {
        // 读失败就跳过，不伪造附件
      }
    }
    setAttachments((prev) => [...prev, ...next])
    if (fileRef.current) fileRef.current.value = ""
  }

  async function sendMessage() {
    if (!canSend) return
    const parts: MessagePart[] = [{ type: "text", text: input.trim() }]
    for (const item of attachments) {
      parts.push({
        type: "file",
        data: item.dataUrl,
        filename: item.name,
        mediaType: item.mediaType,
      })
    }
    setInput("")
    setAttachments([])
    await agent.send(parts)
  }

  const auth = useAuth()

  // 展示用的消息：存档的 transcript 在前，eve 实时消息在后（按 id 去重）。
  // 这样即便 eve 续接不上（旧版本存档 / 运行时重启），历史对话依然看得见。
  const liveMessages = agent.messages as unknown as RawMessage[]
  const storedIds = new Set(initialTranscript.map((m) => m.id))
  const displayed = [
    ...initialTranscript,
    ...liveMessages.filter((m) => !storedIds.has(m.id)),
  ]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 消息流 —— 唯一可滚动区域 */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-3xl space-y-5">
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center gap-3 pt-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-4xl bg-primary/15 text-primary">
                <RiRobot2Line className="size-5" />
              </div>
              <p className="text-lg font-medium">给 {selected.name} 派一个任务</p>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                发送任务描述与要求；Agent 的回复会连同思考过程、工具调用记录一起展示。
                对话会存入「历史任务」，刷新或切页都不会丢。
              </p>
            </div>
          ) : null}

          {resumeSkipped ? (
            <p className="rounded-3xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-muted-foreground">
              这条对话的运行时存档来自旧版本，当前运行时无法续接；已为你新建会话，
              历史内容仍可回看，新消息会接着记录。
            </p>
          ) : null}

          {!auth.signedIn ? (
            <div className="flex items-start gap-2 rounded-4xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
              <RiShieldKeyholeLine className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-xs leading-5">
                <p className="font-medium">需要先登入才能派任务</p>
                <p className="mt-1 text-muted-foreground">
                  用邮箱收验证码，或用钱包签名登入。
                  <Link href="/signin" className="ml-1 font-medium underline-offset-4 hover:underline">
                    去登入
                  </Link>
                </p>
              </div>
            </div>
          ) : null}

          {displayed.map((message) => {
            const isUser = message.role === "user"
            if (isUser) {
              return (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-4xl bg-muted px-4 py-3 text-sm leading-6">
                    <EveMessageBody parts={message.parts} />
                  </div>
                </div>
              )
            }
            return (
              <div key={message.id} className="flex justify-start">
                <div className="w-full space-y-3 rounded-4xl bg-card px-4 py-3 shadow-sm ring-1 ring-foreground/5">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <RiRobot2Line className="size-4" />
                    {selected.name}
                    <Badge variant="secondary" className="ml-auto">
                      <RiCheckboxCircleLine />
                      Agent 执行
                    </Badge>
                  </div>
                  <EveMessageBody parts={message.parts} assistant />
                </div>
              </div>
            )
          })}

          {busy ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RiRefreshLine className="size-3.5 animate-spin" />
              {activityLabel}
            </div>
          ) : null}

          {describedError ? (
            <div className="flex items-start gap-2 rounded-4xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
              <RiErrorWarningLine className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="min-w-0">
                <p className="font-medium">{describedError.title}</p>
                <p className="mt-1 break-words text-xs text-muted-foreground">
                  {describedError.detail}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 输入框 —— 固定置底 */}
      <form
        className="border-t bg-background/95 px-4 py-3 backdrop-blur"
        onSubmit={(event) => {
          event.preventDefault()
          void sendMessage()
        }}
      >
        <div className="mx-auto w-full max-w-3xl">
          <p className="mb-2 text-xs text-muted-foreground">
            {busy ? activityLabel : "空闲"}
          </p>
          {attachments.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((item) => (
                <span
                  key={item.id}
                  className="relative inline-flex items-center gap-1.5 rounded-full border bg-muted/50 py-1 pl-2 pr-7 text-xs"
                >
                  <RiAttachmentLine className="size-3" />
                  <span className="max-w-[10rem] truncate">{item.name}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAttachments((prev) => prev.filter((x) => x.id !== item.id))
                    }
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={`移除 ${item.name}`}
                  >
                    <RiCloseLine className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex items-end gap-2 rounded-4xl border bg-card px-3 py-2 shadow-sm">
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => void onFiles(event.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              title="上传文件消息"
              aria-label="上传文件消息"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <RiAttachmentLine className="size-4" />
            </button>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
              disabled={busy || !selected.live}
              rows={1}
              placeholder="描述任务与要求，Enter 发送，Shift+Enter 换行"
              aria-label="任务消息"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm leading-5 outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <p className="sr-only">Agent 状态：{busy ? activityLabel : "空闲"}</p>
            {busy ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="停止"
                onClick={() => {
                  void agent.cancel()
                }}
              >
                <RiCloseLine className="size-4" />
              </Button>
            ) : (
              <Button type="submit" size="icon" disabled={!canSend} aria-label="发送">
                <RiArrowRightUpLine className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

/**
 * 外层壳：持有「选中的 agent / 模型 / 当前会话」三类状态，并据登录用户计算稳定 key。
 * - 选中需要配置的智能体且尚未开始任务 → 显示配置面板（不挂载 ChatSession）。
 * - 用户「开始任务」→ 创建服务端会话并拿到 id → 挂载 ChatSession（无初始数据，全新会话）。
 * - URL 带 ?session=<id> → 拉取该会话并以 resume 续接。
 */
export function AgentWorkspace({
  models,
  defaultModelId,
}: {
  models: PlaygroundModel[]
  defaultModelId: string
}) {
  const auth = useAuth()
  const [agentId, setAgentId] = useState<string>("coolha-rwa")
  const [modelId, setModelId] = useState(defaultModelId)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [initialData, setInitialData] = useState<{
    session?: Record<string, unknown> | null
    events?: unknown[] | null
  } | null>(null)
  const [initialTranscript, setInitialTranscript] = useState<RawMessage[]>([])
  const [creating, setCreating] = useState(false)
  const [credits, setCredits] = useState<CreditsState | null>(null)
  const [paywallError, setPaywallError] = useState<string | null>(null)
  // 会话载入期间用 ref 兜底：避免与「开始任务」竞争（ref 不触发渲染，无水合差异）
  const loadingRef = useRef(false)
  // 创建中的同步闸门：state 要等 re-render 才生效，双击会漏过去，这里用 ref 同步拦住
  const creatingRef = useRef(false)

  const userKey = auth.address || auth.email || "guest"
  // 等 auth 就绪再用真实用户键，避免落到 guest
  const bootKey = useMemo(
    () => (auth.ready ? userKey : "__boot__"),
    [auth.ready, userKey],
  )

  const selected = AGENTS.find((item) => item.id === agentId) ?? AGENTS[0]
  const requiresConstraints = AGENTS_REQUIRING_CONSTRAINTS.has(selected.id)

  // 服务状态：开放模式可以直接开始；关闭模式没有授权就不能开始。
  // 注意：fetchCredits 是纯读取（不 setState），setState 放在调用方的异步块里。
  const fetchCredits = useCallback(async (): Promise<CreditsState | null> => {
    if (!auth.signedIn) return null
    try {
      const res = await fetch("/api/agents/credits", { cache: "no-store" })
      if (!res.ok) return null
      return (await res.json()) as CreditsState
    } catch {
      // 读不到就返回 null：界面保持「还没读到」，不伪造额度
      return null
    }
  }, [auth.signedIn])

  const refreshCredits = useCallback(async () => {
    const data = await fetchCredits()
    if (data) setCredits(data)
  }, [fetchCredits])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const data = await fetchCredits()
      if (data && !cancelled) setCredits(data)
    })()
    return () => {
      cancelled = true
    }
  }, [fetchCredits])

  // 从 URL 载入历史会话（点「历史任务」里的某条进来时）
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("session")
    if (!param) return
    let cancelled = false
    loadingRef.current = true
    ;(async () => {
      try {
        const res = await fetch(`/api/agents/sessions/${encodeURIComponent(param)}`, {
          cache: "no-store",
        })
        if (!res.ok) return
        const data = (await res.json()) as {
          session?: {
            id: string
            agentId: string
            config?: { model?: string }
            eveSession: unknown
            eveEvents: unknown[]
            transcript?: RawMessage[]
          }
        }
        const s = data?.session
        if (!s || cancelled) return
        if (s.agentId) setAgentId(s.agentId)
        if (s.config?.model) setModelId(s.config.model)
        setInitialData({
          session: (s.eveSession ?? null) as Record<string, unknown> | null,
          events: s.eveEvents ?? [],
        })
        setInitialTranscript(Array.isArray(s.transcript) ? s.transcript : [])
        setSessionId(s.id)
      } catch {
        // 载入失败不阻塞：留在配置态
      } finally {
        if (!cancelled) loadingRef.current = false
      }
    })()
    return () => {
      cancelled = true
      loadingRef.current = false
    }
  }, [])

  const persist = (payload: PersistPayload) => {
    if (!sessionId || !auth.signedIn) return
    fetch(`/api/agents/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eveSession: payload.session,
        eveEvents: payload.events,
        transcript: payload.transcript,
        preview: payload.preview,
        title: payload.title,
      }),
    }).catch(() => {
      // 写入失败不影响当前对话；下次变更会重试
    })
  }

  async function startSession(value: AgentConfigValue) {
    if (!auth.signedIn) return
    // 正在载入历史会话时不新建，避免与载入中的会话竞争
    if (loadingRef.current) return
    // 同步闸门：拦住双击 / 连点，避免生成两个会话、留下孤儿任务
    if (creatingRef.current) return
    creatingRef.current = true
    setCreating(true)
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const config = { model: modelId, constraints: value.constraints }
    try {
      const response = await fetch("/api/agents/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, agentId, title: "新任务", config }),
      })
      if (response.status === 402 || response.status === 503) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string }
        } | null
        setPaywallError(body?.error?.message ?? "当前不能开始任务")
        void refreshCredits()
        return
      }
      if (!response.ok) {
        setPaywallError("创建任务失败，请稍后重试")
        return
      }
      setPaywallError(null)
      setInitialData(null)
      setInitialTranscript([])
      setSessionId(id)
    } catch {
      // 创建失败：保持配置态，用户可重试
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }

  function handleAgentChange(id: string) {
    if (id === "__new__") {
      // 新建任务：回到配置态
      setSessionId(null)
      setInitialData(null)
      setInitialTranscript([])
      return
    }
    // 切换智能体：重置当前会话（强制重新配置）
    setAgentId(id)
    setSessionId(null)
    setInitialData(null)
    setInitialTranscript([])
  }

  const showConfig = selected.live && sessionId === null
  const showChat = selected.live && sessionId !== null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 顶部工具栏：始终可见 */}
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <AgentSelector
          agents={AGENTS}
          value={agentId}
          onChange={handleAgentChange}
          disabled={creating}
        />
        <ModelSelector
          models={models}
          modelId={modelId}
          onChange={setModelId}
          disabled={creating || models.length === 0}
        />
        <div className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/tasks">
              <RiHistoryLine className="size-4" />
              历史任务
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleAgentChange("__new__")}
            disabled={creating}
          >
            <RiAddLine className="size-4" />
            新建任务
          </Button>
        </div>
      </header>

      {showConfig ? (
        <AgentConfigPanel
          agent={selected}
          modelLabel={models.find((m) => m.modelId === modelId)?.name ?? modelId}
          signedIn={auth.signedIn}
          busy={creating}
          requiresConstraints={requiresConstraints}
          credits={credits}
          onRefreshCredits={() => void refreshCredits()}
          paywallError={paywallError}
          onStart={startSession}
        />
      ) : showChat ? (
        <ChatSession
          key={`${bootKey}:${sessionId}`}
          agentId={agentId}
          modelId={modelId}
          sessionId={sessionId}
          initialData={initialData ?? { session: null, events: [] }}
          initialTranscript={initialTranscript}
          onPersist={persist}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
          {selected.name} 暂未上线，敬请期待。
        </div>
      )}
    </div>
  )
}
