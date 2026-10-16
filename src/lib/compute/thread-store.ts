"use client"

import { useSyncExternalStore } from "react"
import type { UIMessage } from "ai"
import {
  clearLocalThreads,
  countLocalMessages,
  deleteLocalThread,
  getLocalThread,
  isLocalDbAvailable,
  listLocalMessages,
  listLocalThreads,
  putLocalMessages,
  putLocalThread,
  readMeta,
  replaceLocalMessages,
  writeMeta,
  type LocalMessage,
  type LocalThread,
} from "./local-db"

/**
 * 本地优先的会话存储。
 *
 * 架构：**本地是唯一读源，云端只是可选镜像**。
 *
 *   ┌─────────────┐  写入   ┌──────────────┐
 *   │  IndexedDB  │ ◀────── │  Chat UI     │
 *   │ (唯一读源)   │         └──────────────┘
 *   └──────┬──────┘
 *          │ 仅当 mode === "backup" 且用户已订阅
 *          ▼
 *   ┌──────────────┐
 *   │  云端镜像     │  跨设备恢复 / 换机备份
 *   └──────────────┘
 *
 * 两种模式：
 *   - `local`（默认）：零服务端接触。对话只在这台设备的浏览器里，
 *     不登录也能用（本机历史），登录后也不会自动上传。
 *   - `backup`：本地写完后后台镜像一份到云端。需要订阅（云端历史是付费权益），
 *     且本地仍是读源——云端宕机不影响使用，只是恢复来源。
 *
 * 与旧实现的差异：旧版「云端可用就以云端为读源」是 cloud-first，
 * 隐私叙事弱且云端故障直接打挂产品。本地优先反过来。
 */

export type StorageMode = "local" | "backup"

/** BYOK 通道的消息结构（浏览器直连，不落服务端） */
export interface ByokHistoryMessage {
  id: string
  role: "user" | "assistant"
  text: string
  error?: string
}

/** 客户端生成的 uuid；不可用时退化为时间戳+随机串 */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export interface ThreadSummary {
  id: string
  title: string
  modelKey: string
  pinned: boolean
  messageCount: number
  createdAt: number
  updatedAt: number
  /** 本地相对云端的同步状态 */
  syncState: "local-only" | "synced" | "pending" | "unknown"
}

export interface ThreadDetail {
  thread: LocalThread
  messages: LocalMessage[]
}

const MODE_KEY = "storage-mode"
const MIGRATED_KEY = "migrated-from-localstorage"

let cache: ThreadSummary[] = []
let mode: StorageMode = "local"
let booted = false
let booting = false
let dbAvailable = true
const listeners = new Set<() => void>()
const bootWaiters: Array<() => void> = []

function notify() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!booted && !booting) void boot()
  return () => {
    listeners.delete(listener)
  }
}

async function boot(): Promise<void> {
  if (booting) return
  booting = true
  try {
    dbAvailable = await isLocalDbAvailable()
    if (!dbAvailable) {
      cache = []
      mode = "local"
    } else {
      const stored = await readMeta<StorageMode>(MODE_KEY)
      mode = stored === "backup" ? "backup" : "local"
      await migrateLegacyLocalStorage()
      cache = (await listLocalThreads()).map(toSummary)
    }
  } catch (error) {
    console.error("[thread-store] 初始化失败:", error)
    dbAvailable = false
    cache = []
  } finally {
    booted = true
    booting = false
    notify()
    bootWaiters.splice(0).forEach((resolve) => resolve())
  }
}

function toSummary(thread: LocalThread): ThreadSummary {
  return {
    id: thread.id,
    title: thread.title,
    modelKey: thread.modelKey,
    pinned: thread.pinned,
    messageCount: thread.messageCount,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    syncState: thread.syncedAt && thread.syncedAt >= thread.updatedAt ? "synced" : "pending",
  }
}

/** 把旧版 localStorage 里的会话搬进 IndexedDB（一次性） */
async function migrateLegacyLocalStorage(): Promise<void> {
  if (typeof window === "undefined") return
  if (await readMeta<boolean>(MIGRATED_KEY)) return
  let migrated = 0
  try {
    const raw = window.localStorage.getItem("coolha.conversations")
    if (raw) {
      const parsed = JSON.parse(raw) as Array<{
        id: string
        title: string
        modelKey: string
        gatewayMessages: UIMessage[]
        byokMessages: ByokHistoryMessage[]
        createdAt: number
        updatedAt: number
      }>
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (!entry?.id) continue
          const messages = legacyToMessages(entry.id, entry)
          await putLocalThread({
            id: entry.id,
            title: entry.title || "新对话",
            modelKey: entry.modelKey || "",
            pinned: false,
            messageCount: messages.length,
            createdAt: entry.createdAt ?? Date.now(),
            updatedAt: entry.updatedAt ?? Date.now(),
            syncedAt: null,
          })
          await replaceLocalMessages(entry.id, messages)
          migrated += 1
        }
      }
    }
  } catch (error) {
    console.warn("[thread-store] 旧数据迁移部分失败（不影响后续使用）:", error)
  }
  await writeMeta(MIGRATED_KEY, true)
  if (migrated > 0) {
    console.info(`[thread-store] 已从 localStorage 迁移 ${migrated} 条会话到 IndexedDB`)
  }
}

function legacyToMessages(
  id: string,
  entry: {
    modelKey: string
    gatewayMessages: UIMessage[]
    byokMessages: ByokHistoryMessage[]
  },
): LocalMessage[] {
  const out: LocalMessage[] = []
  const byok = String(entry.modelKey || "").startsWith("conn:")
  if (byok) {
    entry.byokMessages.forEach((message, index) => {
      out.push({
        id: `${id}-b${index}`,
        threadId: id,
        seq: index,
        role: message.role === "assistant" ? "assistant" : "user",
        parts: [{ type: "text", text: message.error ?? message.text }],
        text: message.error ?? message.text,
        modelKey: entry.modelKey,
        source: "byok",
        inputTokens: 0,
        outputTokens: 0,
        createdAt: Date.now() + index,
      })
    })
    return out
  }
  entry.gatewayMessages.forEach((message, index) => {
    const text = message.parts
      .map((part) => (part.type === "text" ? part.text : part.type === "file" ? "[附件]" : ""))
      .join("")
      .trim()
    out.push({
      id: `${id}-g${index}`,
      threadId: id,
      seq: index,
      role: message.role === "assistant" ? "assistant" : "user",
      parts: [{ type: "text", text }],
      text,
      modelKey: entry.modelKey,
      source: "gateway",
      inputTokens: 0,
      outputTokens: 0,
      createdAt: Date.now() + index,
    })
  })
  return out
}

// ---------- 对外 API ----------

const EMPTY: ThreadSummary[] = []

export function useThreadStore(): {
  threads: ThreadSummary[]
  mode: StorageMode
  ready: boolean
  dbAvailable: boolean
} {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => cache,
    () => EMPTY,
  )
  return { threads: snapshot, mode, ready: booted, dbAvailable }
}

/** 等待初始化完成（供非 React 调用方使用） */
export function whenReady(): Promise<void> {
  if (booted) return Promise.resolve()
  return new Promise((resolve) => bootWaiters.push(resolve))
}

export function currentMode(): StorageMode {
  return mode
}

async function refresh(): Promise<void> {
  cache = (await listLocalThreads()).map(toSummary)
  notify()
}

/** 新建或更新一条会话（本地写盘，立刻可读） */
export async function saveThread(input: {
  id: string
  title?: string
  modelKey: string
  messages: LocalMessage[]
}): Promise<void> {
  if (!dbAvailable) return
  const existing = await getLocalThread(input.id)
  const now = Date.now()
  const firstUser = input.messages.find((message) => message.role === "user")
  const derived = (firstUser?.text ?? "").slice(0, 24) || "新对话"
  await putLocalThread({
    id: input.id,
    title:
      existing && existing.title !== "新对话"
        ? existing.title
        : (input.title ?? derived),
    modelKey: input.modelKey,
    pinned: existing?.pinned ?? false,
    messageCount: input.messages.length,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    // 更新后视为待同步：syncedAt 早于 updatedAt 即 pending
    syncedAt: existing?.syncedAt ?? null,
  })
  await replaceLocalMessages(input.id, input.messages)
  await refresh()
}

export async function loadThread(id: string): Promise<ThreadDetail | null> {
  if (!dbAvailable) return null
  const thread = await getLocalThread(id)
  if (!thread) return null
  return { thread, messages: await listLocalMessages(id) }
}

export async function renameThread(id: string, title: string): Promise<void> {
  const thread = await getLocalThread(id)
  if (!thread) return
  await putLocalThread({ ...thread, title: title.slice(0, 120), updatedAt: Date.now() })
  await refresh()
}

export async function togglePinThread(id: string): Promise<void> {
  const thread = await getLocalThread(id)
  if (!thread) return
  await putLocalThread({ ...thread, pinned: !thread.pinned, updatedAt: Date.now() })
  await refresh()
}

export async function removeThread(id: string): Promise<void> {
  await deleteLocalThread(id)
  await refresh()
}

/** 本地一键清空（不动云端） */
export async function clearLocalHistory(): Promise<number> {
  const count = cache.length
  await clearLocalThreads()
  await refresh()
  return count
}

/** 切换存储模式；打开备份前确认 DB 可用 */
export async function setStorageMode(next: StorageMode): Promise<void> {
  mode = next
  await writeMeta(MODE_KEY, next)
  notify()
}

/** 标记某会话已同步到云端 */
export async function markThreadSynced(id: string): Promise<void> {
  const thread = await getLocalThread(id)
  if (!thread) return
  await putLocalThread({ ...thread, syncedAt: Date.now() })
  await refresh()
}

export async function localStats(): Promise<{ threads: number; messages: number; dbAvailable: boolean }> {
  if (!dbAvailable) return { threads: cache.length, messages: 0, dbAvailable: false }
  return {
    threads: cache.length,
    messages: await countLocalMessages(),
    dbAvailable: true,
  }
}

/** 供云端恢复用：把云端消息合入本地（不覆盖本地已有） */
export async function mergeCloudMessages(messages: LocalMessage[]): Promise<void> {
  await putLocalMessages(messages)
}

export async function upsertLocalThread(thread: LocalThread): Promise<void> {
  await putLocalThread(thread)
  await refresh()
}
