import type { Metadata } from "next"
import Link from "next/link"
import { RiAddLine, RiArrowRightUpLine } from "react-icons/ri"

import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/neon/session"
import { listChatSessions } from "@/lib/neon/chat-sessions"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "历史任务",
  description: "在智能对话里执行过的任务会话，按时间倒序排列，点开可续看或接着聊。",
}

const AGENT_NAMES: Record<string, string> = {
  "coolha-rwa": "CoolhaRWAagent",
  "contract-audit": "Contract Audit",
  "defi-analytics": "DeFi Analytics",
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function TasksPage() {
  const user = await getCurrentUser()
  const signedIn = Boolean(user)
  const sessions = signedIn && user ? await listChatSessions(user.subject).catch(() => []) : []

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-normal">历史任务</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/">
            <RiAddLine className="size-4" />
            新建任务
          </Link>
        </Button>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        这里列出你在智能对话里执行过的任务会话。点开任意一条即可续看对话、接着聊。
      </p>

      {!signedIn ? (
        <p className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          查看自己的任务需要先在
          <Link href="/signin" className="underline underline-offset-4">
            登入
          </Link>
          。
        </p>
      ) : sessions.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">还没有执行记录。去智能对话里派第一个任务吧。</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link
                href={`/?session=${encodeURIComponent(session.id)}`}
                className="block rounded-2xl border bg-card p-4 transition-colors hover:bg-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {session.title || "未命名任务"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {AGENT_NAMES[session.agentId] ?? session.agentId}
                      {session.preview ? ` · ${session.preview}` : ""}
                    </p>
                  </div>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <RiArrowRightUpLine className="size-4" />
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatTime(session.updatedAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
