"use client"

import { useState } from "react"
import type { AgentApiKeyRecord } from "@/lib/agents/api-key-types"
import type { ResearchRunView } from "@/lib/agents/rwa-research"
import { Button } from "@/components/ui/button"

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
  return body?.error?.message ?? `请求失败（${response.status}）`
}

export function ConsoleDesk({
  signedIn,
  initialKeys,
  initialRuns,
}: {
  signedIn: boolean
  initialKeys: AgentApiKeyRecord[]
  initialRuns: ResearchRunView[]
}) {
  const [keys, setKeys] = useState(initialKeys)
  const [runs] = useState(initialRuns)
  const [label, setLabel] = useState("个人助手")
  const [secret, setSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function createKey() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch("/api/agents/rwa-research/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      })
      if (!response.ok) {
        setError(await readError(response))
        return
      }
      const body = (await response.json()) as { key: AgentApiKeyRecord; secret: string }
      setSecret(body.secret)
      setKeys((current) => [body.key, ...current.filter((item) => item.id !== body.key.id)])
    } catch {
      setError("创建失败")
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/agents/rwa-research/keys/${id}`, { method: "DELETE" })
      if (!response.ok) {
        setError(await readError(response))
        return
      }
      setKeys((current) =>
        current.map((item) =>
          item.id === id ? { ...item, revokedAt: new Date().toISOString() } : item,
        ),
      )
    } catch {
      setError("撤销失败")
    } finally {
      setBusy(false)
    }
  }

  if (!signedIn) {
    return <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">请先在侧边栏签名登录。</p>
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-medium">API Key</h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          创建后完整密钥只出现一次。库里只有哈希。外部调用必须带这把 Key，不能靠当前页面的登录状态。
        </p>
        <div className="mt-3 flex gap-2">
          <input
            className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm"
            value={label}
            maxLength={40}
            onChange={(event) => setLabel(event.target.value)}
            aria-label="Key 名称"
          />
          <Button type="button" onClick={createKey} disabled={busy || label.trim().length < 1}>
            创建
          </Button>
        </div>
        {secret ? (
          <div className="mt-3 rounded-xl border border-amber-500/40 p-3">
            <p className="text-xs">请立刻复制。离开或点确认后，页面不再显示。</p>
            <code className="mt-2 block break-all text-sm">{secret}</code>
            <Button type="button" className="mt-2" variant="outline" onClick={() => setSecret(null)}>
              我已复制
            </Button>
          </div>
        ) : null}
        <ul className="mt-3 space-y-2 text-sm">
          {keys.map((key) => (
            <li key={key.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
              <span>
                {key.label} · {key.prefix}… · {key.revokedAt ? "已撤销" : "有效"}
              </span>
              {key.revokedAt ? null : (
                <Button type="button" variant="outline" onClick={() => revoke(key.id)} disabled={busy}>
                  撤销
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
      {error ? <p className="text-sm">{error}</p> : null}
      <section>
        <h2 className="text-sm font-medium">最近任务</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {runs.length === 0 ? <li className="text-muted-foreground">还没有执行记录。</li> : null}
          {runs.map((run) => (
            <li key={run.orderId} className="rounded-xl border p-3">
              {run.channel} · {run.target} · {run.status} · 未付款 · {run.createdAt}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
