"use client"

import { useRef, useState } from "react"
import { RiErrorWarningLine, RiLoader4Line } from "react-icons/ri"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { FIELD_CLASS, friendlyAuthMessage, safeAuthCall } from "./auth-ui"

/**
 * 判断错误是不是「邮箱还没验证」。
 *
 * 实测 Neon Auth 返回 `403 { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" }`，
 * 所以同时看 code / message / status，避免上游换个措辞就识别不出来。
 */
function looksUnverified(error: { message?: string; code?: string; status?: number }) {
  const text = `${error.code ?? ""} ${error.message ?? ""}`
  return /verif|未验证/i.test(text) || error.status === 403
}

/**
 * 邮箱 + 密码登入。
 *
 * 注意当前 Neon Auth 配置是 `requireEmailVerification: true`：
 * 没做过邮箱验证的账号即使密码正确也登不进来，必须先用验证码完成验证。
 * 所以这里遇到「未验证」时不是报错了事，而是把人引到验证码那条路。
 */
export function PasswordSignIn({
  initialEmail = "",
  onSignedIn,
  onNeedVerify,
}: {
  initialEmail?: string
  onSignedIn: () => void
  onNeedVerify: (email: string) => void
}) {
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unverified, setUnverified] = useState(false)

  async function submit() {
    const target = email.trim().toLowerCase()
    if (!target || !password) {
      setError("请填写邮箱和密码")
      return
    }
    setPending(true)
    setError(null)
    setUnverified(false)
    const { error: signInError } = await safeAuthCall(() =>
      authClient.signIn.email({ email: target, password }),
    )
    if (signInError) {
      setError(friendlyAuthMessage(signInError))
      setUnverified(looksUnverified(signInError))
      setPending(false)
      return
    }
    onSignedIn()
    setPending(false)
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        aria-label="邮箱"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className={FIELD_CLASS}
      />
      <input
        type="password"
        autoComplete="current-password"
        aria-label="密码"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="密码"
        className={FIELD_CLASS}
      />
      <Button type="submit" disabled={pending} className="h-11 w-full rounded-full text-sm font-bold">
        {pending ? (
          <>
            <RiLoader4Line className="size-4 animate-spin" />
            登入中…
          </>
        ) : (
          "登入"
        )}
      </Button>

      {error ? (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs leading-5">
            <RiErrorWarningLine className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-muted-foreground">{error}</p>
          </div>
          {unverified ? (
            <button
              type="button"
              onClick={() => onNeedVerify(email.trim().toLowerCase())}
              className="w-full rounded-full border px-3 py-2 text-xs font-medium hover:bg-muted/60"
            >
              邮箱还没验证，改用验证码登入
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}

/**
 * 注册：邮箱 + 密码 → 发验证码 → 验证邮箱 → 自动登入。
 *
 * Neon Auth 这边 `sendVerificationEmailOnSignUp` 是关的，注册不会自动发信，
 * 所以要显式调一次 `sendVerificationOtp(type: "email-verification")`。
 * `autoSignInAfterVerification` 是开的，验证通过后服务端会直接建会话。
 */
export function SignUpFlow({
  onSignedIn,
  onExistingAccount,
}: {
  onSignedIn: () => void
  onExistingAccount: (email: string) => void
}) {
  const [stage, setStage] = useState<"form" | "code">("form")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [code, setCode] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [existing, setExisting] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  async function createAccount() {
    const target = email.trim().toLowerCase()
    if (!target.includes("@")) {
      setError("请填写正确的邮箱")
      return
    }
    if (password.length < 8) {
      setError("密码至少 8 位")
      return
    }
    if (password !== confirm) {
      setError("两次输入的密码不一致")
      return
    }
    setPending(true)
    setError(null)
    setExisting(false)

    const { error: signUpError } = await safeAuthCall(() =>
      authClient.signUp.email({
        email: target,
        password,
        name: name.trim() || target.split("@")[0],
      }),
    )
    if (signUpError) {
      setError(friendlyAuthMessage(signUpError))
      setExisting(/exist|already|已注册|已存在/i.test(`${signUpError.code ?? ""} ${signUpError.message}`))
      setPending(false)
      return
    }

    // 该分支 sendVerificationEmailOnSignUp 是关的，注册不会自动发信，必须显式发一次
    const { error: sendError } = await safeAuthCall(() =>
      authClient.emailOtp.sendVerificationOtp({ email: target, type: "email-verification" }),
    )
    if (sendError) {
      setError(`账号已创建，但验证码发送失败：${sendError.message}`)
      setPending(false)
      return
    }

    setStage("code")
    setNotice(`验证码已发送到 ${target}，10 分钟内有效。`)
    setPending(false)
    setTimeout(() => codeRef.current?.focus(), 60)
  }

  async function verify() {
    const target = email.trim().toLowerCase()
    const otp = code.replace(/\s/g, "")
    if (otp.length < 4) {
      setError("请填写邮件里的验证码")
      return
    }
    setPending(true)
    setError(null)

    const { error: verifyError } = await safeAuthCall(() =>
      authClient.emailOtp.verifyEmail({ email: target, otp }),
    )
    if (verifyError) {
      setError(friendlyAuthMessage(verifyError))
      setPending(false)
      return
    }

    // autoSignInAfterVerification 应该已经建了会话；没建成就用刚设的密码补一次登入
    const session = await safeAuthCall(() => authClient.getSession())
    const hasSession = Boolean(
      (session.data as { session?: unknown } | null)?.session,
    )
    if (!hasSession) {
      const { error: signInError } = await safeAuthCall(() =>
        authClient.signIn.email({ email: target, password }),
      )
      if (signInError) {
        setNotice("邮箱已验证，请用刚才的密码登入。")
        setStage("form")
        setPending(false)
        return
      }
    }
    onSignedIn()
    setPending(false)
  }

  if (stage === "code") {
    return (
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          void verify()
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
              验证中…
            </>
          ) : (
            "验证并登入"
          )}
        </Button>
        <button
          type="button"
          onClick={() => {
            setStage("form")
            setCode("")
            setError(null)
          }}
          className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          返回修改信息
        </button>
        {notice ? (
          <p className="rounded-2xl bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
            {notice}
          </p>
        ) : null}
        {error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs leading-5">
            <RiErrorWarningLine className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-muted-foreground">{error}</p>
          </div>
        ) : null}
      </form>
    )
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        void createAccount()
      }}
    >
      <input
        type="text"
        autoComplete="nickname"
        aria-label="昵称"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={40}
        placeholder="昵称（可选）"
        className={FIELD_CLASS}
      />
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        aria-label="邮箱"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className={FIELD_CLASS}
      />
      <input
        type="password"
        autoComplete="new-password"
        aria-label="密码"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="设置密码（至少 8 位）"
        className={FIELD_CLASS}
      />
      <input
        type="password"
        autoComplete="new-password"
        aria-label="确认密码"
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        placeholder="再输一次密码"
        className={FIELD_CLASS}
      />
      <Button type="submit" disabled={pending} className="h-11 w-full rounded-full text-sm font-bold">
        {pending ? (
          <>
            <RiLoader4Line className="size-4 animate-spin" />
            创建中…
          </>
        ) : (
          "创建账号"
        )}
      </Button>

      {error ? (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs leading-5">
            <RiErrorWarningLine className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-muted-foreground">{error}</p>
          </div>
          {existing ? (
            <button
              type="button"
              onClick={() => onExistingAccount(email.trim().toLowerCase())}
              className="w-full rounded-full border px-3 py-2 text-xs font-medium hover:bg-muted/60"
            >
              这个邮箱已注册，去登入
            </button>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}
