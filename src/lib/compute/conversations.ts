"use client"

import { useSyncExternalStore } from "react"
import type { UIMessage } from "ai"

/**
 * 对话历史：只存在浏览器 localStorage，不上传服务器。
 * 与模型连接同理——Coolha 不经手用户数据。
 */

export interface ByokHistoryMessage {
  id: string
  role: "user" | "assistant"
  text: string
  error?: string
}

export interface Conversation {
  id: string
  /** 取首条用户消息前 24 字作为标题 */
  title: string
  /** 使用的模型（free:<slug> / conn:<id>:<model>） */
  modelKey: string
  /** 免费模型通道的消息（AI SDK UIMessage） */
  gatewayMessages: UIMessage[]
  /** 自带连接通道的消息 */
  byokMessages: ByokHistoryMessage[]
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = "coolha.conversations"
const MAX_CONVERSATIONS = 50

let snapshot: Conversation[] | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function isValid(entry: unknown): entry is Conversation {
  if (!entry || typeof entry !== "object") return false
  const item = entry as Partial<Conversation>
  return typeof item.id === "string" && typeof item.title === "string" && typeof item.updatedAt === "number"
}

function read(): Conversation[] {
  if (snapshot) return snapshot
  if (typeof window === "undefined") {
    snapshot = []
    return snapshot
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown[]) : []
    snapshot = Array.isArray(parsed) ? parsed.filter(isValid) : []
  } catch {
    snapshot = []
  }
  return snapshot
}

function write(next: Conversation[]) {
  snapshot = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, MAX_CONVERSATIONS)))
  } catch {
    // 配额不足：仅内存态生效
  }
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const EMPTY: Conversation[] = []

export function useConversations(): Conversation[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return "新对话"
  return clean.length > 24 ? `${clean.slice(0, 24)}…` : clean
}

/** 新建（或覆盖更新）一条会话 */
export function saveConversation(input: {
  id: string
  title?: string
  modelKey: string
  gatewayMessages: UIMessage[]
  byokMessages: ByokHistoryMessage[]
}): Conversation {
  const list = read()
  const existing = list.find((item) => item.id === input.id)
  const firstUser = extractFirstUserText(input.gatewayMessages, input.byokMessages)
  const entry: Conversation = {
    id: input.id,
    title: existing?.title && existing.title !== "新对话"
      ? existing.title
      : (input.title ?? firstUser ?? "新对话"),
    modelKey: input.modelKey,
    gatewayMessages: input.gatewayMessages,
    byokMessages: input.byokMessages,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  }
  write([entry, ...list.filter((item) => item.id !== input.id)])
  return entry
}

export function removeConversation(id: string): void {
  write(read().filter((item) => item.id !== id))
}

export function clearConversations(): void {
  write([])
}

function extractFirstUserText(
  gateway: UIMessage[],
  byok: ByokHistoryMessage[],
): string | undefined {
  const gatewayUser = gateway.find((message) => message.role === "user")
  if (gatewayUser) {
    const text = gatewayUser.parts
      .map((part) => (part.type === "text" ? part.text : ""))
      .join(" ")
      .trim()
    if (text) return deriveTitle(text)
  }
  const byokUser = byok.find((message) => message.role === "user")
  return byokUser ? deriveTitle(byokUser.text) : undefined
}
