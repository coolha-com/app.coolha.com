"use client"

import { useState } from "react"
import { RiLoader4Line } from "react-icons/ri"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { AFTER_SIGN_IN, SignedInScreen, useFinishSignIn } from "./auth-ui"
import { OtpSignIn } from "./OtpSignIn"
import { PasswordSignIn, SignUpFlow } from "./PasswordAuth"

export { AFTER_SIGN_IN }

type Tab = "otp" | "password" | "signup"

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "otp", label: "验证码" },
  { id: "password", label: "密码" },
  { id: "signup", label: "注册" },
]

const COPY: Record<Tab, { title: string; hint: string }> = {
  otp: {
    title: "登入 Coolha",
    hint: "用邮箱收一个验证码即可，不需要密码。",
  },
  password: {
    title: "登入 Coolha",
    hint: "用注册时设置的邮箱和密码登入。",
  },
  signup: {
    title: "注册 Coolha",
    hint: "用邮箱和密码创建账号，会发一个验证码到你邮箱，验证后自动登入。",
  },
}

/**
 * Web2 登入面板：验证码 / 密码 / 注册三种方式，加 Google。
 *
 * 为什么三种都要：验证码对老用户最快；密码是用户主动要求的能力；
 * 注册是新用户入口。三者最终都落到同一个 Neon Auth 用户，再由业务层收敛成 users.id。
 */
export function Web2SignIn({ onSignedIn }: { onSignedIn?: () => void }) {
  const [tab, setTab] = useState<Tab>("otp")
  const [email, setEmail] = useState("")
  const [done, setDone] = useState(false)
  const [socialPending, setSocialPending] = useState(false)
  const [socialError, setSocialError] = useState<string | null>(null)

  useFinishSignIn(done, onSignedIn)

  async function continueWithGoogle() {
    setSocialPending(true)
    setSocialError(null)
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: AFTER_SIGN_IN,
      })
      // 成功时浏览器会被带走，走不到这里；走到这里基本就是没配上或上游出错
      if (error) {
        setSocialError(error.message ?? "Google 登录不可用")
        setSocialPending(false)
      }
    } catch (failure) {
      setSocialError(failure instanceof Error ? failure.message : "Google 登录不可用")
      setSocialPending(false)
    }
  }

  if (done) return <SignedInScreen />

  const copy = COPY[tab]

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{copy.hint}</p>
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-full bg-muted/60 p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id)
              setSocialError(null)
            }}
            aria-pressed={tab === item.id}
            className={
              tab === item.id
                ? "rounded-full bg-card px-2 py-1.5 text-xs font-bold shadow-sm"
                : "rounded-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "otp" ? (
        <OtpSignIn initialEmail={email} onSignedIn={() => setDone(true)} />
      ) : null}

      {tab === "password" ? (
        <PasswordSignIn
          initialEmail={email}
          onSignedIn={() => setDone(true)}
          onNeedVerify={(target) => {
            setEmail(target)
            setTab("otp")
          }}
        />
      ) : null}

      {tab === "signup" ? (
        <SignUpFlow
          onSignedIn={() => setDone(true)}
          onExistingAccount={(target) => {
            setEmail(target)
            setTab("password")
          }}
        />
      ) : null}

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        或
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={socialPending}
        onClick={() => void continueWithGoogle()}
        className="h-11 w-full rounded-full text-sm font-medium"
      >
        {socialPending ? <RiLoader4Line className="size-4 animate-spin" /> : null}
        用 Google 继续
      </Button>

      {socialError ? (
        <p className="text-center text-xs text-destructive">{socialError}</p>
      ) : null}
    </div>
  )
}
