"use client"

import { useState } from "react"
import type { AgentApiKeyRecord } from "@/lib/agents/api-key-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
  return body?.error?.message ?? `请求失败（${response.status}）`
}

export function ConsoleDesk({
  signedIn,
  initialKeys,
  initialSessions,
}: {
  signedIn: boolean
  initialKeys: AgentApiKeyRecord[]
  initialSessions: { id: string; title: string; preview: string; updatedAt: string }[]
}) {
  const [keys, setKeys] = useState(initialKeys)
  const [sessions] = useState(initialSessions)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function revoke(id: string) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/agents/keys/${id}`, { method: "DELETE" })
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
    return <p className="rounded-2xl border bg-muted/40 p-4 text-sm">请先在侧边栏登入。</p>
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">API Key</h2>
          <Badge variant="outline">未启用</Badge>
        </div>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          普通用户端不签发凭证。已有记录可以撤销。MCP 不接受这些 Key。
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {keys.length === 0 ? <li className="text-muted-foreground">没有已保存的凭证。</li> : null}
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
          {sessions.length === 0 ? <li className="text-muted-foreground">还没有执行记录。</li> : null}
          {sessions.map((session) => (
            <li key={session.id} className="rounded-xl border p-3">
              {session.title || "未命名任务"}
              {session.preview ? ` · ${session.preview}` : ""} · {session.updatedAt}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
