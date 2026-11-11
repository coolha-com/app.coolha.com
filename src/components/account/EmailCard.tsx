"use client"

import { useState } from "react"
import { RiCheckLine, RiErrorWarningLine, RiLoader4Line, RiMailLine } from "react-icons/ri"

import { Surface } from "@/components/PageShell"
import { ACCOUNT_CARD_CLASS, ACCOUNT_ROW_CLASS } from "./styles"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

const FIELD_CLASS =
  "h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none focus:border-primary/60"

/**
 * 邮箱：展示 + 修改。
 *
 * 修改走 Neon Auth 的 change-email：服务端往新邮箱发一封带 token 的验证信，
 * 用户点链接回来才算改完 —— 不改成「输入新邮箱立刻生效」，
 * 否则任何人都能把别人账号的邮箱改走。
 */
export function EmailCard({
  email,
  emailVerified,
  hasNeonAuth,
}: {
  email: string | null
  emailVerified: boolean
  hasNeonAuth: boolean
}) {
  const [open, setOpen] = useState(false)
  const [nextEmail, setNextEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit() {
    const target = nextEmail.trim().toLowerCase()
    if (!target || !target.includes("@")) {
      setMessage({ ok: false, text: "请填写正确的邮箱地址" })
      return
    }
    setPending(true)
    setMessage(null)
    try {
      const { error } = await authClient.changeEmail({
        newEmail: target,
        callbackURL: `${window.location.origin}/settings/account`,
      })
      if (error) {
        setMessage({ ok: false, text: error.message ?? "修改失败" })
        return
      }
      setMessage({ ok: true, text: `验证邮件已发送到 ${target}，点开邮件里的链接即可完成修改。` })
      setOpen(false)
      setNextEmail("")
    } catch (failure) {
      setMessage({
        ok: false,
        text: failure instanceof Error ? failure.message : "修改失败",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Surface className={ACCOUNT_CARD_CLASS}>
      <div className={ACCOUNT_ROW_CLASS}>
        <div className="flex min-w-0 items-center gap-2">
          <RiMailLine className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm">{email ?? "未绑定邮箱"}</span>
          {email ? (
            <span
              className={
                emailVerified
                  ? "shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-foreground"
                  : "shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-foreground"
              }
            >
              {emailVerified ? "已验证" : "待验证"}
            </span>
          ) : null}
        </div>
        {hasNeonAuth && email ? (
          <button
            type="button"
            onClick={() => {
              setOpen((value) => !value)
              setMessage(null)
            }}
            className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {open ? "取消" : "修改邮箱"}
          </button>
        ) : null}
      </div>

      {!hasNeonAuth ? (
        <p className="rounded-2xl bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
          这个账号只有钱包登录，没有邮箱可改。想用邮箱登录，请用邮箱注册一个新账号，再在下方把钱包绑定过去。
        </p>
      ) : null}

      {open && hasNeonAuth ? (
        <div className="space-y-2">
          <input
            type="email"
            value={nextEmail}
            onChange={(event) => setNextEmail(event.target.value)}
            placeholder="新邮箱"
            className={FIELD_CLASS}
          />
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={pending}
            className="h-9 rounded-full px-4 text-xs font-bold"
          >
            {pending ? <RiLoader4Line className="size-4 animate-spin" /> : null}
            发送验证邮件
          </Button>
        </div>
      ) : null}

      {message ? (
        <p
          className={
            message.ok
              ? "inline-flex items-start gap-1.5 rounded-2xl bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground"
              : "inline-flex items-start gap-1.5 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive"
          }
        >
          {message.ok ? (
            <RiCheckLine className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <RiErrorWarningLine className="mt-0.5 size-3.5 shrink-0" />
          )}
          {message.text}
        </p>
      ) : null}
    </Surface>
  )
}
