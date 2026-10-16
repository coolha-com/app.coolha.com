"use client"

import { useSyncExternalStore } from "react"
import type { UIMessage } from "ai"
import type { ByokHistoryMessage } from "./thread-store"

/**
 * 云端会话历史（付费权益：Plus 起）。
 *
 * 与 `useConnections` / `useSubscriptionStatus` 同一套模式：拉取发生在 `subscribe` 内，
 * 不在组件 effect 里 setState，避免级联渲染与 lint 规则冲突。
 *
 * 隐私边界：**只上传对话正文与模型标识，任何 API Key 都不上行**。
 * 图片 / 文件的 dataUrl 在上报前由 `toCloudMessages` 剥离，只保留文本与占位说明。
 */

export interface CloudThreadView {
  id: string
  title: string
  modelKey: string | null
  pinned: boolean
  messageCount: number
  updatedAt: number
}

export interface CloudMessageView {
  id: string
  role: "user" | "assistant" | "system"
  parts: unknown[]
  text: string
  modelKey: string | null
  source: "gateway" | "byok"
  createdAt: string
}

export type CloudStatus = "loading" | "ready" | "anonymous" | "disabled" | "error"

export interface CloudState {
  status: CloudStatus
  plan: string
  threads: CloudThreadView[]
}

export interface CloudMessageInput {
  role: "user" | "assistant"
  parts: Array<{ type: "text"; text: string }>
  text: string
  source: "gateway" | "byok"
}

let cache: CloudState = { status: "loading", plan: "free", threads: [] }
let loaded = false
let fetching = false
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

function toMillis(value: string): number {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Date.now()
}

async function readError(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as { error?: { message?: string; code?: string } }
    return json?.error?.message ?? `请求失败（${response.status}）`
  } catch {
    return `请求失败（${response.status}）`
  }
}

async function load(): Promise<void> {
  if (fetching) return
  fetching = true
  try {
    const response = await fetch("/api/chat/threads", { credentials: "same-origin" })
    if (response.status === 401) {
      cache = { status: "anonymous", plan: "free", threads: [] }
    } else if (response.status === 403) {
      cache = { status: "disabled", plan: "free", threads: [] }
    } else if (!response.ok) {
      cache = { status: "error", plan: "free", threads: [] }
    } else {
      const json = (await response.json()) as {
        plan?: string
        threads?: Array<Record<string, unknown>>
      }
      cache = {
        status: "ready",
        plan: typeof json.plan === "string" ? json.plan : "free",
        threads: (json.threads ?? []).map((row) => ({
          id: String(row.id),
          title: String(row.title ?? "新对话"),
          modelKey: typeof row.modelKey === "string" ? row.modelKey : null,
          pinned: Boolean(row.pinned),
          messageCount: Number(row.messageCount ?? 0),
          updatedAt: toMillis(String(row.updatedAt ?? Date.now())),
        })),
      }
    }
  } catch {
    cache = { status: "error", plan: "free", threads: [] }
  } finally {
    fetching = false
    loaded = true
    notify()
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!loaded) void load()
  return () => {
    listeners.delete(listener)
  }
}

function readSnapshot(): CloudState {
  return cache
}

const EMPTY: CloudState = { status: "loading", plan: "free", threads: [] }

export function useCloudThreads(): CloudState {
  return useSyncExternalStore(subscribe, readSnapshot, () => EMPTY)
}

/** 登录状态变化、删除会话后重新拉取 */
export async function refreshCloudThreads(): Promise<void> {
  await load()
}

/** 剥离图片 / 文件数据，只上报文本与占位说明 */
export function toCloudMessages(input: {
  modelKey: string
  gatewayMessages: UIMessage[]
  byokMessages: ByokHistoryMessage[]
}): CloudMessageInput[] {
  const source: "gateway" | "byok" = input.modelKey.startsWith("conn:") ? "byok" : "gateway"
  if (source === "byok") {
    return input.byokMessages.map((message) => ({
      role: message.role,
      parts: [{ type: "text", text: message.error ?? message.text }],
      text: message.error ?? message.text,
      source: "byok",
    }))
  }
  return input.gatewayMessages.map((message) => {
    const text = message.parts
      .map((part) => (part.type === "text" ? part.text : part.type === "file" ? "[附件]" : ""))
      .join("")
      .trim()
    return {
      role: message.role === "assistant" ? "assistant" : "user",
      parts: [{ type: "text", text }],
      text,
      source: "gateway",
    }
  })
}

/** 云端消息还原为本地双通道结构 */
export function fromCloudMessages(messages: CloudMessageView[]): {
  gatewayMessages: UIMessage[]
  byokMessages: ByokHistoryMessage[]
} {
  const gatewayMessages: UIMessage[] = []
  const byokMessages: ByokHistoryMessage[] = []
  messages.forEach((message, index) => {
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
      metadata: { seq: index },
    })
  })
  return { gatewayMessages, byokMessages }
}

export interface CloudResult {
  ok: boolean
  message?: string
}

export async function createCloudThread(input: {
  id?: string
  title?: string
  modelKey?: string
}): Promise<{ id: string | null; message?: string }> {
  try {
    const response = await fetch("/api/chat/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        id: input.id,
        title: input.title ?? "新对话",
        modelKey: input.modelKey,
      }),
    })
    if (!response.ok) return { id: null, message: await readError(response) }
    const json = (await response.json()) as { thread?: { id?: string } }
    return { id: json.thread?.id ?? null }
  } catch (error) {
    return { id: null, message: error instanceof Error ? error.message : "创建会话失败" }
  }
}

export async function saveCloudMessages(
  threadId: string,
  input: { messages: CloudMessageInput[]; title?: string; modelKey?: string },
): Promise<CloudResult> {
  try {
    const response = await fetch(`/api/chat/threads/${threadId}/messages`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(input),
    })
    if (!response.ok) return { ok: false, message: await readError(response) }
    return { ok: true }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "保存失败" }
  }
}

export async function loadCloudThread(
  threadId: string,
): Promise<{ thread: CloudThreadView; messages: CloudMessageView[] } | null> {
  try {
    const response = await fetch(`/api/chat/threads/${threadId}`, { credentials: "same-origin" })
    if (!response.ok) return null
    const json = (await response.json()) as {
      thread?: Record<string, unknown>
      messages?: CloudMessageView[]
    }
    if (!json.thread) return null
    return {
      thread: {
        id: String(json.thread.id),
        title: String(json.thread.title ?? "新对话"),
        modelKey: typeof json.thread.modelKey === "string" ? json.thread.modelKey : null,
        pinned: Boolean(json.thread.pinned),
        messageCount: Number(json.thread.messageCount ?? 0),
        updatedAt: toMillis(String(json.thread.updatedAt ?? Date.now())),
      },
      messages: json.messages ?? [],
    }
  } catch {
    return null
  }
}

export async function deleteCloudThread(threadId: string): Promise<CloudResult> {
  try {
    const response = await fetch(`/api/chat/threads/${threadId}`, {
      method: "DELETE",
      credentials: "same-origin",
    })
    if (!response.ok) return { ok: false, message: await readError(response) }
    await refreshCloudThreads()
    return { ok: true }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "删除失败" }
  }
}

/** 一键清空云端全部历史（不可恢复） */
export async function clearCloudHistory(): Promise<CloudResult & { removed?: number }> {
  try {
    const response = await fetch("/api/chat/history", {
      method: "DELETE",
      credentials: "same-origin",
    })
    if (!response.ok) return { ok: false, message: await readError(response) }
    const json = (await response.json()) as { removed?: number }
    await refreshCloudThreads()
    return { ok: true, removed: json.removed }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "清空失败" }
  }
}
