"use client"

import { useState } from "react"
import { RiCheckLine, RiErrorWarningLine, RiLoader4Line, RiLockLine } from "react-icons/ri"

import { Surface } from "@/components/PageShell"
import { ACCOUNT_CARD_CLASS, ACCOUNT_ROW_CLASS } from "./styles"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

const FIELD_CLASS =
  "h-10 w-full rounded-2xl border bg-background px-3 text-sm outline-none focus:border-primary/60"

/**
 * 密码：设置 / 修改。
 *
 * 这个账号体系原本是「邮箱验证码，无密码」，所以第一次是**设置**密码（setPassword），
 * 之后才是**修改**（changePassword，要校验当前密码）。
 * 密码只是邮箱验证码之外的第二种登入方式，不是账号的唯一凭据。
 */
export function PasswordCard({
  hasPassword,
  hasNeonAuth,
}: {
  hasPassword: boolean
  hasNeonAuth: boolean
}) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  function reset() {
    setCurrent("")
    setNext("")
    setConfirm("")
  }

  async function submit() {
    if (next.length < 8) {
      setMessage({ ok: false, text: "新密码至少 8 位" })
      return
    }
    if (next !== confirm) {
      setMessage({ ok: false, text: "两次输入的新密码不一致" })
      return
    }
    setPending(true)
    setMessage(null)
    try {
      if (hasPassword) {
        const result = await authClient.changePassword({
          currentPassword: current,
          newPassword: next,
          revokeOtherSessions: true,
        })
        if (result.error) {
          setMessage({ ok: false, text: result.error.message ?? "保存失败" })
          return
        }
      } else {
        // 客户端 SDK 没有暴露 setPassword（首次设密码的端点），直接打 Neon Auth 的代理路由。
        // 这条只在账号还没有 credential 记录时用，有密码后再改走 changePassword（要校验旧密码）。
        const response = await fetch("/api/auth/set-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ newPassword: next }),
        })
        if (!response.ok) {
          const json = (await response.json().catch(() => ({}))) as {
            message?: string
            error?: { message?: string }
          }
          setMessage({
            ok: false,
            text: json.message ?? json.error?.message ?? "设置密码失败",
          })
          return
        }
      }
      setMessage({ ok: true, text: hasPassword ? "密码已更新" : "密码已设置，之后可用邮箱 + 密码登入" })
      reset()
      setOpen(false)
    } catch (failure) {
      setMessage({
        ok: false,
        text: failure instanceof Error ? failure.message : "保存失败",
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <Surface className={ACCOUNT_CARD_CLASS}>
      <div className={ACCOUNT_ROW_CLASS}>
        <div className="flex items-center gap-2">
          <RiLockLine className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-sm">{hasPassword ? "已设置密码" : "未设置密码"}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {hasPassword ? "邮箱 + 密码可登入" : hasNeonAuth ? "当前仅验证码登入" : "不适用"}
          </span>
        </div>
        {hasNeonAuth ? (
          <button
            type="button"
            onClick={() => {
              setOpen((value) => !value)
              setMessage(null)
            }}
            className="shrink-0 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {open ? "取消" : hasPassword ? "修改密码" : "设置密码"}
          </button>
        ) : null}
      </div>

      {!hasNeonAuth ? (
        <p className="rounded-2xl bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
          钱包账号没有密码这一说 —— 登录凭据就是你钱包里的私钥。
        </p>
      ) : null}

      {open && hasNeonAuth ? (
        <div className="space-y-2">
          {hasPassword ? (
            <input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              placeholder="当前密码"
              className={FIELD_CLASS}
            />
          ) : null}
          <input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(event) => setNext(event.target.value)}
            placeholder="新密码（至少 8 位）"
            className={FIELD_CLASS}
          />
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="再输一次新密码"
            className={FIELD_CLASS}
          />
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={pending}
            className="h-9 rounded-full px-4 text-xs font-bold"
          >
            {pending ? <RiLoader4Line className="size-4 animate-spin" /> : null}
            {hasPassword ? "更新密码" : "设置密码"}
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
