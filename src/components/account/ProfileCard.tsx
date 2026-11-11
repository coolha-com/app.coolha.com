"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RiCheckLine, RiErrorWarningLine, RiLoader4Line } from "react-icons/ri"

import { Surface } from "@/components/PageShell"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { useAuth } from "@/hooks/useAuth"

const FIELD_CLASS =
  "h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none focus:border-primary/60"

export function ProfileCard({
  displayName,
  email,
  image,
  fallbackLabel,
}: {
  displayName: string | null
  email: string | null
  image: string | null
  fallbackLabel: string
}) {
  const router = useRouter()
  const { refresh, source } = useAuth()
  const [name, setName] = useState(displayName ?? "")
  const [avatar, setAvatar] = useState(image ?? "")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function save() {
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ displayName: name, avatarUrl: avatar }),
      })
      const json = (await response.json()) as { error?: { message?: string } }
      if (!response.ok) {
        setMessage({ ok: false, text: json.error?.message ?? "保存失败" })
        return
      }
      // Neon Auth 那边也同步一份，避免用户在其它设备用 Neon 自带界面看到旧名字。
      // 纯钱包账号没有 Neon 用户，跳过即可。
      if (source === "web2") {
        await authClient
          .updateUser({ name: name.trim() || undefined, image: avatar.trim() || null })
          .catch(() => undefined)
      }
      setMessage({ ok: true, text: "已保存" })
      refresh()
      router.refresh()
    } catch {
      setMessage({ ok: false, text: "保存失败，请检查网络" })
    } finally {
      setPending(false)
    }
  }

  const preview = avatar.trim() || image || ""
  const label = (name.trim() || displayName || email || fallbackLabel).slice(0, 1).toUpperCase()

  return (
    <Surface className="space-y-4 px-5 py-4">
      <div className="flex items-center gap-3">
        <Avatar className="size-12 shrink-0 border">
          {preview ? <AvatarImage src={preview} alt="头像" /> : null}
          <AvatarFallback className="bg-primary/15 font-semibold text-foreground">
            {label}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name.trim() || displayName || "未设置名称"}</p>
          <p className="truncate text-xs text-muted-foreground">{email ?? "未绑定邮箱"}</p>
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">名称</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          placeholder="显示在侧边栏与账户页"
          className={FIELD_CLASS}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">头像链接（可选）</span>
        <input
          value={avatar}
          onChange={(event) => setAvatar(event.target.value)}
          placeholder="https://… 留空则用首字母头像"
          className={FIELD_CLASS}
        />
      </label>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={pending}
          className="h-9 rounded-full px-4 text-xs font-bold"
        >
          {pending ? <RiLoader4Line className="size-4 animate-spin" /> : null}
          保存资料
        </Button>
        {message ? (
          <span
            className={
              message.ok
                ? "inline-flex items-center gap-1 text-xs text-muted-foreground"
                : "inline-flex items-center gap-1 text-xs text-destructive"
            }
          >
            {message.ok ? (
              <RiCheckLine className="size-3.5" />
            ) : (
              <RiErrorWarningLine className="size-3.5" />
            )}
            {message.text}
          </span>
        ) : null}
      </div>
    </Surface>
  )
}
