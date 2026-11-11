"use client"

import { useEffect, useRef, useState } from "react"
import { RiArrowRightLine, RiErrorWarningLine, RiLoader4Line, RiMailLine } from "react-icons/ri"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { friendlyAuthMessage, safeAuthCall } from "./auth-ui"

/**
 * 邮箱验证码登入（无密码）。
 *
 * 对**已有账号**来说这是最省事的路径：输邮箱、收 6 位码、进站。
 * 对**没验证过的密码账号**，走一遍这里也能完成邮箱验证。
 */
export function OtpSignIn({
  initialEmail = "",
  onSignedIn,
}: {
  initialEmail?: string
  onSignedIn: () => void
}) {
  const [stage, setStage] = useState<"email" | "code">("email")
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  async function sendCode() {
    const target = email.trim().toLowerCase()
    if (!target) {
      setError("请填写邮箱")
      return
    }
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      const { error: sendError } = await safeAuthCall(() =>
        authClient.emailOtp.sendVerificationOtp({ email: target, type: "sign-in" }),
      )
      if (sendError) {
        setError(friendlyAuthMessage(sendError))
        return
      }
      setStage("code")
      setCooldown(60)
      setNotice(`验证码已发送到 ${target}，10 分钟内有效。`)
      setTimeout(() => codeRef.current?.focus(), 60)
    } catch (sendFailure) {
      setError(sendFailure instanceof Error ? sendFailure.message : "验证码发送失败")
    } finally {
      setPending(false)
    }
  }

  async function verifyCode() {
    const target = email.trim().toLowerCase()
    const otp = code.replace(/\s/g, "")
    if (otp.length < 4) {
      setError("请填写邮件里的验证码")
      return
    }
    setPending(true)
    setError(null)
    try {
      const { error: verifyError } = await safeAuthCall(() =>
        authClient.signIn.emailOtp({ email: target, otp }),
      )
      if (verifyError) {
        setError(friendlyAuthMessage(verifyError))
        return
      }
      onSignedIn()
    } catch (verifyFailure) {
      setError(verifyFailure instanceof Error ? verifyFailure.message : "登录失败")
    } finally {
      setPending(false)
    }
  }

  if (stage === "email") {
    return (
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          void sendCode()
        }}
      >
        <div className="flex items-center gap-2 rounded-2xl border bg-background px-3 focus-within:border-primary/60">
          <RiMailLine className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            aria-label="邮箱"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
          />
        </div>
        <Button type="submit" disabled={pending} className="h-11 w-full rounded-full text-sm font-bold">
          {pending ? (
            <>
              <RiLoader4Line className="size-4 animate-spin" />
              发送中…
            </>
          ) : (
            <>
              发送验证码
              <RiArrowRightLine className="size-4" />
            </>
          )}
        </Button>
        {error ? <ErrorLine text={error} /> : null}
      </form>
    )
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        void verifyCode()
      }}
    >
      <input
        ref={codeRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={8}
        aria-label="验证码"
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/[^\d]/g, ""))}
        placeholder="6 位数字"
        className="h-11 w-full rounded-2xl border bg-background px-3 text-center text-lg tracking-[0.4em] outline-none focus:border-primary/60"
      />
      <Button type="submit" disabled={pending} className="h-11 w-full rounded-full text-sm font-bold">
        {pending ? (
          <>
            <RiLoader4Line className="size-4 animate-spin" />
            校验中…
          </>
        ) : (
          "登入"
        )}
      </Button>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => {
            setStage("email")
            setCode("")
            setError(null)
            setNotice(null)
          }}
          className="underline-offset-4 hover:text-foreground hover:underline"
        >
          换个邮箱
        </button>
        <button
          type="button"
          disabled={cooldown > 0 || pending}
          onClick={() => void sendCode()}
          className="underline-offset-4 hover:text-foreground hover:underline disabled:no-underline disabled:opacity-50"
        >
          {cooldown > 0 ? `${cooldown}s 后可重发` : "重新发送"}
        </button>
      </div>
      {notice ? (
        <p className="rounded-2xl bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
          {notice}
        </p>
      ) : null}
      {error ? <ErrorLine text={error} /> : null}
    </form>
  )
}

export function ErrorLine({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs leading-5">
      <RiErrorWarningLine className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p className="text-muted-foreground">{text}</p>
    </div>
  )
}

