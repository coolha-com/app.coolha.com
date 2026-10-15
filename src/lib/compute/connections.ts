"use client"

import { useSyncExternalStore } from "react"

/**
 * 用户自己的模型服务连接（BYOK）。
 *
 * 隐私边界：名称、Base URL、API Key、常用模型全部只存在浏览器 localStorage，
 * 永不上传 Coolha 服务器；对话请求由浏览器直连用户端点。
 *
 * 连接（Key 级）是唯一事实来源：Playground 的「我的模型」= 连接 × 该连接的常用模型。
 * 旧版按模型存储的 byok 数据（coolha.byok.models）会在首次读取时自动迁移。
 */

export type VendorId =
  | "openai"
  | "deepseek"
  | "openrouter"
  | "siliconflow"
  | "moonshot"
  | "groq"
  | "ollama"
  | "custom"

export interface VendorPreset {
  id: VendorId
  label: string
  /** OpenAI 兼容端点 */
  baseURL: string
  /** 是否需要 API Key（本机 Ollama 不需要） */
  needsKey: boolean
  hint?: string
}

export const VENDOR_PRESETS: VendorPreset[] = [
  { id: "openai", label: "OpenAI", baseURL: "https://api.openai.com/v1", needsKey: true },
  { id: "deepseek", label: "DeepSeek", baseURL: "https://api.deepseek.com/v1", needsKey: true },
  { id: "openrouter", label: "OpenRouter", baseURL: "https://openrouter.ai/api/v1", needsKey: true },
  { id: "siliconflow", label: "硅基流动", baseURL: "https://api.siliconflow.cn/v1", needsKey: true },
  { id: "moonshot", label: "Moonshot", baseURL: "https://api.moonshot.cn/v1", needsKey: true },
  { id: "groq", label: "Groq", baseURL: "https://api.groq.com/openai/v1", needsKey: true },
  { id: "ollama", label: "Ollama（本机）", baseURL: "http://localhost:11434/v1", needsKey: false },
  { id: "custom", label: "自定义（OpenAI 兼容）", baseURL: "", needsKey: true, hint: "填写你的 OpenAI 兼容地址，通常以 /v1 结尾" },
]

export interface ApiConnection {
  id: string
  /** 用户自定义名称，如「主力账号」 */
  name: string
  vendor: VendorId
  baseURL: string
  apiKey: string
  /** 常用模型 ID 列表 */
  models: string[]
  enabled: boolean
  createdAt: number
  /** 最近一次连通性测试 */
  lastTestedAt?: number
  lastTestOk?: boolean
  lastTestMessage?: string
}

const STORAGE_KEY = "coolha.connections"
const LEGACY_KEY = "coolha.byok.models"
const listeners = new Set<() => void>()

let snapshot: ApiConnection[] | null = null

function emit() {
  for (const listener of listeners) listener()
}

function isValid(entry: unknown): entry is ApiConnection {
  if (!entry || typeof entry !== "object") return false
  const item = entry as Partial<ApiConnection>
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.baseURL === "string" &&
    typeof item.apiKey === "string" &&
    Array.isArray(item.models)
  )
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `conn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function guessVendor(baseURL: string): VendorId {
  const match = VENDOR_PRESETS.find((preset) => preset.baseURL && baseURL.startsWith(preset.baseURL))
  return match?.id ?? "custom"
}

/** 旧版按模型存储的数据 → 按 baseURL+key 归并为连接 */
function migrateLegacy(): ApiConnection[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<{
      label?: string
      baseURL?: string
      model?: string
      apiKey?: string
    }>
    if (!Array.isArray(parsed)) return []

    const byEndpoint = new Map<string, ApiConnection>()
    for (const item of parsed) {
      if (!item?.baseURL || !item?.apiKey) continue
      const baseURL = item.baseURL.replace(/\/+$/, "")
      const key = `${baseURL}::${item.apiKey}`
      const existing = byEndpoint.get(key)
      if (existing) {
        if (item.model && !existing.models.includes(item.model)) existing.models.push(item.model)
        continue
      }
      byEndpoint.set(key, {
        id: newId(),
        name: item.label?.trim() || "我的连接",
        vendor: guessVendor(baseURL),
        baseURL,
        apiKey: item.apiKey,
        models: item.model ? [item.model] : [],
        enabled: true,
        createdAt: Date.now(),
      })
    }
    const migrated = [...byEndpoint.values()]
    if (migrated.length > 0) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated))
    }
    window.localStorage.removeItem(LEGACY_KEY)
    return migrated
  } catch {
    return []
  }
}

function read(): ApiConnection[] {
  if (snapshot) return snapshot
  if (typeof window === "undefined") {
    snapshot = []
    return snapshot
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      snapshot = migrateLegacy()
      return snapshot
    }
    const parsed = JSON.parse(raw) as unknown
    snapshot = Array.isArray(parsed) ? parsed.filter(isValid) : []
  } catch {
    snapshot = []
  }
  return snapshot
}

function write(next: ApiConnection[]) {
  snapshot = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 隐私模式/配额不足：仅内存态生效
  }
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const EMPTY: ApiConnection[] = []

export function useConnections(): ApiConnection[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}

export function normalizeBaseURL(input: string): string {
  return input.trim().replace(/\/+$/, "")
}

export type ConnectionInput = Omit<ApiConnection, "id" | "createdAt" | "enabled"> &
  Partial<Pick<ApiConnection, "enabled">>

export function addConnection(input: ConnectionInput): ApiConnection {
  const baseURL = normalizeBaseURL(input.baseURL)
  const entry: ApiConnection = {
    id: newId(),
    name: input.name.trim() || "我的连接",
    vendor: input.vendor,
    baseURL,
    apiKey: input.apiKey.trim(),
    models: input.models.map((model) => model.trim()).filter(Boolean),
    enabled: input.enabled ?? true,
    createdAt: Date.now(),
  }
  write([...read(), entry])
  return entry
}

export function updateConnection(id: string, patch: Partial<ApiConnection>): void {
  write(read().map((item) => (item.id === id ? { ...item, ...patch, id: item.id } : item)))
}

export function removeConnection(id: string): void {
  write(read().filter((item) => item.id !== id))
}

/** 记录连通性测试结果（不触碰 key） */
export function recordTestResult(
  id: string,
  result: { ok: boolean; message?: string },
): void {
  updateConnection(id, {
    lastTestedAt: Date.now(),
    lastTestOk: result.ok,
    lastTestMessage: result.message,
  })
}

/**
 * 连通性测试：浏览器直连 `{baseURL}/models`（OpenAI 兼容的模型列表接口）。
 * 不发送任何对话内容；同样受目标端点 CORS 策略约束。
 */
export async function testConnection(connection: ApiConnection): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(`${connection.baseURL}/models`, {
      headers: {
        Accept: "application/json",
        ...(connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {}),
      },
    })
    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}` }
    }
    const json = (await response.json().catch(() => null)) as { data?: unknown[] } | null
    const count = Array.isArray(json?.data) ? json.data.length : 0
    return { ok: true, message: count > 0 ? `连接正常 · 可用模型 ${count} 个` : "连接正常" }
  } catch (error) {
    if (error instanceof TypeError) {
      return { ok: false, message: "无法直连（可能未开放浏览器跨域 CORS）" }
    }
    return { ok: false, message: error instanceof Error ? error.message : "未知错误" }
  }
}

export function maskKey(key: string): string {
  if (!key) return "—"
  if (key.length <= 8) return `${key.slice(0, 2)}••••`
  return `${key.slice(0, 4)}••••••${key.slice(-4)}`
}
