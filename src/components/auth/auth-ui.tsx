"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { RiCheckLine } from "react-icons/ri"

import { refreshAuthSession } from "@/hooks/useAuth"

/** 登录成功后回到应用的位置 */
export const AFTER_SIGN_IN = "/chat"

/** 表单输入框统一尺寸 */
export const FIELD_CLASS =
  "h-11 w-full rounded-2xl border bg-background px-3 text-sm outline-none focus:border-primary/60"

/**
 * 登入 / 注册成功后统一收尾：刷新会话快照（否则侧边栏还显示「登入」）再跳转。
 * done 由调用方置为 true，这里只负责副作用与成功态渲染。
 */
export function useFinishSignIn(done: boolean, onSignedIn?: () => void) {
  const router = useRouter()
  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => {
      void refreshAuthSession()
      onSignedIn?.()
      router.replace(AFTER_SIGN_IN)
    }, 900)
    return () => clearTimeout(timer)
  }, [done, router, onSignedIn])
}

export function SignedInScreen() {
  return (
    <div className="space-y-6 py-2 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <RiCheckLine className="size-6" />
      </span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight">已登入</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          正在进入 Coolha<span className="ml-0.5 animate-pulse">…</span>
        </p>
      </div>
    </div>
  )
}

export interface AuthError {
  message: string
  code?: string
  status?: number
}

/**
 * 把 Neon Auth 的英文错误翻成人话。
 * 用户看到「Email verification required」不知道下一步该干什么，
 * 所以这里按 code 优先、message 兜底给一句可执行的提示。
 */
export function friendlyAuthMessage(error: AuthError): string {
  const text = `${error.code ?? ""} ${error.message ?? ""}`
  if (/EMAIL_NOT_VERIFIED|Email not verified|Email verification required/i.test(text)) {
    return "邮箱还没验证，请先用验证码完成验证"
  }
  if (/INVALID_EMAIL_OR_PASSWORD|Invalid email or password/i.test(text)) {
    return "邮箱或密码不正确"
  }
  if (/USER_ALREADY_EXISTS|already exists|already registered/i.test(text)) {
    return "这个邮箱已经注册过了，直接登入即可"
  }
  if (/PASSWORD_TOO_SHORT|too short/i.test(text)) {
    return "密码太短，至少 8 位"
  }
  if (/INVALID_EMAIL/i.test(text)) {
    return "邮箱格式不正确"
  }
  if (/TOO_MANY_REQUESTS|rate.?limit/i.test(text)) {
    return "操作太频繁，请稍后再试"
  }
  if (/INVALID_OTP|OTP.*(invalid|expired)|invalid code/i.test(text)) {
    return "验证码不正确或已过期"
  }
  return error.message || "请求失败，请稍后重试"
}

/**
 * 把 Neon Auth 客户端的两种失败形态归一：「返回 { error }」和「直接 throw」。
 *
 * 实测 `signIn.email` 在 403（邮箱未验证）时是**抛异常**而不是返回 error，
 * 只写 `if (result.error)` 会漏掉这一类，UI 就只剩一句英文报错、没有补救入口。
 */
export async function safeAuthCall<T>(
  fn: () => Promise<{ data?: T | null; error?: unknown }>,
): Promise<{ data: T | null; error: AuthError | null }> {
  try {
    const result = await fn()
    if (result?.error) {
      const err = result.error as AuthError & { body?: { code?: string } }
      return {
        data: null,
        error: {
          message: err.message ?? "请求失败",
          code: err.body?.code ?? err.code,
          status: err.status,
        },
      }
    }
    return { data: (result?.data as T) ?? null, error: null }
  } catch (failure) {
    const err = failure as {
      message?: string
      status?: number
      code?: string
      body?: { code?: string; message?: string }
    }
    return {
      data: null,
      error: {
        message: err?.body?.message ?? err?.message ?? "请求失败，请稍后重试",
        code: err?.body?.code ?? err?.code,
        status: err?.status,
      },
    }
  }
}
