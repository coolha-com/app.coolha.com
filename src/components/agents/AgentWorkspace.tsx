"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { useEveAgent } from "eve/react"
import { activity } from "eve/events"
import type { MessagePart, EveToolPart } from "eve/client"
import {
  RiAddLine,
  RiArrowRightUpLine,
  RiAttachmentLine,
  RiBrainLine,
  RiCheckboxCircleLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiHistoryLine,
  RiRefreshLine,
  RiRobot2Line,
  RiShieldKeyholeLine,
  RiTerminalBoxLine,
} from "react-icons/ri"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ModelSelector } from "@/components/ai-elements/model-selector"
import { useAuth } from "@/hooks/useAuth"
import type { PlaygroundModel } from "@/lib/ai-gateway/shared"

/**
 * Agent 执行通道（Chat 形态）。
 *
 * 不是 ChatGPT 式纯聊天：消息流里把 eve 投影出的 message parts 逐类渲染——
 * reasoning = 思考过程，tool = 执行过程，text = 结果。
 * 执行引擎是 eve Runtime（/eve/v1/*）。
 *
 * 模型切换是真实的：选中的平台模型 ID 随请求头送到 Next 代理，代理按
 * AI Gateway 目录白名单校验后注入 eve 的 auth 属性，agent/agent.ts 的
 * defineDynamic 在每次模型调用前读取。只提供平台模型，不接受自带 Key。
 */

const AGENTS_DIRECTORY = "__all-agents__"

const AGENTS = [
  {
    id: "coolha-rwa",
    name: "CoolhaRWAagent",
    subtitle: "RWA 尽调 Agent",
    live: true,
  },
  { id: "contract-audit", name: "Contract Audit", subtitle: "合约审查", live: false },
  { id: "defi-analytics", name: "DeFi Analytics", subtitle: "DeFi 分析", live: false },
] as const

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
      return state
  }
}

/**
 * 错误如实分类：不把上游状态笼统说成「执行失败」，也不吞掉原文
 * （Vercel 的 request id 是联系支持时必须提供的凭证）。
 * 项目原则：未接入 / 被停用要如实说明，绝不返回占位成功。
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
  return { title: "Agent 执行失败", detail: message }
}

function ToolStep({ part }: { part: EveToolPart }) {
  return (
    <div className="rounded-3xl bg-muted/50 px-3 py-2 text-xs leading-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium">
          <RiTerminalBoxLine className="size-3.5 text-muted-foreground" />
          {part.label || part.name}
        </span>
        <span className="text-muted-foreground">{toolStateLabel(part.state)}</span>
      </div>
      {"inputText" in part && part.inputText ? (
        <p className="mt-1 break-all text-muted-foreground">输入：{part.inputText}</p>
      ) : null}
      {"output" in part && part.output !== undefined ? (
        <p className="mt-1 break-all text-muted-foreground">
          输出：{JSON.stringify(part.output).slice(0, 300)}
        </p>
      ) : null}
      {"error" in part && part.error ? (
        <p className="mt-1 text-destructive">失败：{String(part.error)}</p>
      ) : null}
    </div>
  )
}

export function AgentWorkspace({
  models,
  defaultModelId,
}: {
  models: PlaygroundModel[]
  defaultModelId: string
}) {
  const router = useRouter()
  const [agentId, setAgentId] = useState<string>("coolha-rwa")
  const [modelId, setModelId] = useState(defaultModelId)
  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // Web2 与钱包任一登录都算——服务端也只认 users.id，不看登录方式
  const { signedIn } = useAuth()
  // headers 用函数形式：每次请求解析当前选中模型，切换后下一轮立即生效。
  const agent = useEveAgent({
    headers: () => ({ "x-coolha-eve-model": modelId }),
  })
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 工具栏：Agent 切换列表 / 平台模型切换列表 / 新建会话 */}
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RiRobot2Line className="size-3.5" />
          <select
            value={agentId}
            onChange={(event) => {
              if (event.target.value === AGENTS_DIRECTORY) {
                router.push("/agents")
                return
              }
              setAgentId(event.target.value)
            }}
            aria-label="切换 Agent"
            className="max-w-[13rem] rounded-full border bg-background px-3 py-1.5 text-xs font-medium text-foreground outline-none"
          >
            {AGENTS.map((item) => (
              <option key={item.id} value={item.id} disabled={!item.live}>
                {item.name}
                {item.live ? "" : "（未上线）"}
              </option>
            ))}
            <option value={AGENTS_DIRECTORY}>全部智能服务 →</option>
          </select>
        </label>
        <ModelSelector
          models={models}
          modelId={modelId}
          onChange={setModelId}
          disabled={busy || models.length === 0}
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
            onClick={() => agent.newSession()}
            disabled={busy}
          >
            <RiAddLine className="size-4" />
            新建任务
          </Button>
        </div>
      </header>

      {/* 消息流 */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto w-full max-w-3xl space-y-5">
          {agent.messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 pt-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-4xl bg-primary/15 text-primary">
                <RiRobot2Line className="size-5" />
              </div>
              <p className="text-lg font-medium">给 {selected.name} 派一个任务</p>
              <p className="max-w-md text-sm leading-6 text-muted-foreground">
                发送任务描述与要求；Agent 的回复会连同思考过程、工具调用记录一起展示。
                报告不构成审计或投资意见，订单付款状态为未付款。
              </p>
            </div>
          ) : null}

          {!signedIn ? (
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

          {agent.messages.map((message) => {
            const reasoning = message.parts.filter((p) => p.type === "reasoning")
            const tools = message.parts.filter(
              (p): p is EveToolPart => p.type === "tool",
            )
            const texts = message.parts.filter((p) => p.type === "text")
            const files = message.parts.filter((p) => p.type === "file")
            const isUser = message.role === "user"

            if (isUser) {
              return (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-4xl bg-muted px-4 py-3 text-sm leading-6">
                    {texts.map((part, i) =>
                      part.type === "text" ? (
                        <p key={i} className="whitespace-pre-wrap">
                          {part.text}
                        </p>
                      ) : null,
                    )}
                    {files.length > 0 ? (
                      <p className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                        {files.map((part, i) =>
                          part.type === "file" ? (
                            <span key={i} className="rounded-full border px-2 py-0.5">
                              <RiAttachmentLine className="mr-1 inline size-3" />
                              {part.filename ?? "附件"}
                            </span>
                          ) : null,
                        )}
                      </p>
                    ) : null}
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

                  {reasoning.length > 0 ? (
                    <details className="rounded-3xl bg-muted/40 px-3 py-2 text-xs leading-5">
                      <summary className="flex cursor-pointer items-center gap-1.5 font-medium">
                        <RiBrainLine className="size-3.5" />
                        思考过程 · {reasoning.length} 段
                      </summary>
                      <div className="mt-2 space-y-2 text-muted-foreground">
                        {reasoning.map((part, i) =>
                          part.type === "reasoning" ? (
                            <p key={i} className="whitespace-pre-wrap">
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
                        {tools.map((part) => (
                          <li key={part.callId}>
                            <ToolStep part={part} />
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : null}

                  {texts.map((part, i) =>
                    part.type === "text" ? (
                      <p key={i} className="whitespace-pre-wrap text-sm leading-6">
                        {part.text}
                      </p>
                    ) : null,
                  )}
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

      {/* 输入框 */}
      <form
        className="border-t bg-background/95 px-4 py-3 backdrop-blur"
        onSubmit={(event) => {
          event.preventDefault()
          void sendMessage()
        }}
      >
        <div className="mx-auto w-full max-w-3xl">
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
            <Button type="submit" size="icon" disabled={!canSend} aria-label="发送">
              <RiArrowRightUpLine className="size-4" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
