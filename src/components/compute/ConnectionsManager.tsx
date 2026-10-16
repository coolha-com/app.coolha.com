"use client"

import { useState } from "react"
import {
  RiAddLine,
  RiCheckLine,
  RiCloseLine,
  RiDeleteBin6Line,
  RiEditLine,
  RiKey2Line,
  RiLink,
  RiLinkUnlink,
  RiLoader4Line,
  RiPlugLine,
} from "react-icons/ri"
import {
  addConnection,
  maskKey,
  recordTestResult,
  removeConnection,
  testConnection,
  updateConnection,
  useConnections,
  VENDOR_PRESETS,
  type ApiConnection,
  type VendorId,
} from "@/lib/compute/connections"
import { cn } from "@/lib/utils"

type Draft = {
  id?: string
  name: string
  vendor: VendorId
  baseURL: string
  apiKey: string
  models: string
}

const EMPTY_DRAFT: Draft = { name: "", vendor: "openai", baseURL: "", apiKey: "", models: "" }

function toDraft(connection: ApiConnection): Draft {
  return {
    id: connection.id,
    name: connection.name,
    vendor: connection.vendor,
    baseURL: connection.baseURL,
    apiKey: connection.apiKey,
    models: connection.models.join(", "),
  }
}

/**
 * 我的 API 连接：管理用户自己的模型服务密钥。
 * 密钥与端点只保存在本浏览器，不上传服务器。
 */
export function ConnectionsManager() {
  const connections = useConnections()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const onTest = async (connection: ApiConnection) => {
    setTestingId(connection.id)
    const result = await testConnection(connection)
    recordTestResult(connection.id, result)
    setTestingId(null)
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft) return
    const preset = VENDOR_PRESETS.find((item) => item.id === draft.vendor)
    const baseURL = (draft.baseURL.trim() || preset?.baseURL || "").replace(/\/+$/, "")
    if (!baseURL) return setFormError("请填写 API 端点")
    if (!/^https?:\/\//i.test(baseURL)) {
      return setFormError("端点需以 http:// 或 https:// 开头（OpenAI 兼容地址，通常含 /v1）")
    }
    if (preset?.needsKey && !draft.apiKey.trim()) return setFormError("请填写 API Key")
    if (draft.id) {
      updateConnection(draft.id, {
        name: draft.name.trim() || "我的连接",
        vendor: draft.vendor,
        baseURL,
        apiKey: draft.apiKey.trim(),
        models: draft.models.split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean),
      })
    } else {
      addConnection({
        name: draft.name.trim() || "我的连接",
        vendor: draft.vendor,
        baseURL,
        apiKey: draft.apiKey.trim(),
        models: draft.models.split(/[,，\s]+/).map((item) => item.trim()).filter(Boolean),
      })
    }
    setFormError(null)
    setDraft(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          添加你自己的模型服务，Chat 会直连调用它们对话。
        </p>
        <button
          type="button"
          onClick={() => {
            setFormError(null)
            setDraft(draft ? null : { ...EMPTY_DRAFT })
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
        >
          {draft ? <RiCloseLine className="size-4" /> : <RiAddLine className="size-4" />}
          {draft ? "取消" : "添加连接"}
        </button>
      </div>

      {draft ? (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">连接名称</span>
              <input
                className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                placeholder="如：主力账号"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs text-muted-foreground">服务商</span>
              <select
                className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={draft.vendor}
                onChange={(event) => {
                  const vendor = event.target.value as VendorId
                  const preset = VENDOR_PRESETS.find((item) => item.id === vendor)
                  setDraft({
                    ...draft,
                    vendor,
                    baseURL: preset?.baseURL ?? draft.baseURL,
                    apiKey: preset?.needsKey === false ? "" : draft.apiKey,
                  })
                }}
              >
                {VENDOR_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs text-muted-foreground">API 端点（OpenAI 兼容）</span>
              <input
                className="h-9 rounded-lg border bg-background px-3 font-mono text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                placeholder="https://api.example.com/v1"
                value={draft.baseURL}
                onChange={(event) => setDraft({ ...draft, baseURL: event.target.value })}
              />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs text-muted-foreground">API Key（仅存本浏览器）</span>
              <input
                className="h-9 rounded-lg border bg-background px-3 font-mono text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                type="password"
                placeholder="sk-..."
                value={draft.apiKey}
                onChange={(event) => setDraft({ ...draft, apiKey: event.target.value })}
              />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="text-xs text-muted-foreground">常用模型 ID（逗号分隔，可稍后填）</span>
              <input
                className="h-9 rounded-lg border bg-background px-3 font-mono text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                placeholder="gpt-4o-mini, deepseek-chat"
                value={draft.models}
                onChange={(event) => setDraft({ ...draft, models: event.target.value })}
              />
            </label>
          </div>
          {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground"
            >
              <RiCheckLine className="size-4" />
              {draft.id ? "保存修改" : "保存连接"}
            </button>
            <span className="text-xs text-muted-foreground">密钥保存在本浏览器，不会上传</span>
          </div>
        </form>
      ) : null}

      {connections.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <RiPlugLine className="size-5" />
          </div>
          <p className="mt-3 text-sm font-medium">还没有连接</p>
          <p className="mt-1 text-sm text-muted-foreground">
            添加一个模型服务（OpenAI、DeepSeek、OpenRouter、Ollama 或任意兼容端点）即可开始对话。
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {connections.map((connection) => (
            <li
              key={connection.id}
              className="rounded-2xl border bg-card p-4 shadow-sm transition-opacity"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{connection.name}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {VENDOR_PRESETS.find((item) => item.id === connection.vendor)?.label ??
                        connection.vendor}
                    </span>
                    {!connection.enabled ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        已停用
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {connection.baseURL}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {maskKey(connection.apiKey)}
                  </p>
                  {connection.models.length > 0 ? (
                    <p className="mt-2 flex flex-wrap gap-1">
                      {connection.models.map((model) => (
                        <span
                          key={model}
                          className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                        >
                          {model}
                        </span>
                      ))}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      未填写模型 ID，在 Chat 里也能直接输入使用
                    </p>
                  )}
                  {connection.lastTestedAt ? (
                    <p
                      className={cn(
                        "mt-2 text-xs",
                        connection.lastTestOk ? "text-primary" : "text-destructive",
                      )}
                    >
                      {connection.lastTestOk ? "✓ " : "✕ "}
                      {connection.lastTestMessage} ·{" "}
                      {new Date(connection.lastTestedAt).toLocaleString("zh-CN", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onTest(connection)}
                    disabled={testingId === connection.id}
                    title="测试连接"
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                  >
                    {testingId === connection.id ? (
                      <RiLoader4Line className="size-4 animate-spin" />
                    ) : (
                      <RiPlugLine className="size-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateConnection(connection.id, { enabled: !connection.enabled })}
                    title={connection.enabled ? "停用" : "启用"}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {connection.enabled ? (
                      <RiLink className="size-4" />
                    ) : (
                      <RiLinkUnlink className="size-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormError(null)
                      setDraft(toDraft(connection))
                    }}
                    title="编辑"
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <RiEditLine className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeConnection(connection.id)}
                    title="删除"
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <RiDeleteBin6Line className="size-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <RiKey2Line className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Coolha 不签发、不转售任何 API Key，也不代理你的模型调用。连接信息与密钥只保存在你的浏览器，
          对话请求由浏览器直连服务商，费用由你的账户承担。
        </span>
      </p>
    </div>
  )
}
