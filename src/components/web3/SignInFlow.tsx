"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAppKit, useAppKitAccount } from "@reown/appkit/react"
import {
  RiArrowRightLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiLoopRightLine,
  RiShieldKeyholeLine,
  RiWallet3Line,
} from "react-icons/ri"

import { Button } from "@/components/ui/button"
import { Web2SignIn, AFTER_SIGN_IN } from "@/components/auth/Web2SignIn"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { refreshAuthSession } from "@/hooks/useAuth"

function shortAddress(address?: string) {
  if (!address) return ""
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * 登录卡片：Web2（邮箱验证码 / Google）为主，钱包签名登录为第二入口。
 *
 * 钱包入口与上面的主按钮同款同宽，点一下直接唤起 AppKit 选钱包——
 * 中间不再套一层面板，少一次点击等于少一半流失。
 * 连上之后同一个按钮就地变成「签署并登入」，路径没有分叉。
 */
export function SignInFlow() {
  const router = useRouter()
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const { signedIn, signIn, signOut, error } = useWalletAuth()
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!signedIn) return
    const timer = setTimeout(() => {
      void refreshAuthSession()
      router.replace(AFTER_SIGN_IN)
    }, 900)
    return () => clearTimeout(timer)
  }, [signedIn, router])

  if (signedIn) {
    return (
      <div className="space-y-6 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <RiCheckLine className="size-6" />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">已登入</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            正在进入 Coolha<span className="ml-0.5 animate-pulse">…</span>
          </p>
        </div>
        <div className="space-y-3">
          <Button asChild className="h-11 w-full rounded-full text-sm font-bold">
            <Link href={AFTER_SIGN_IN}>
              进入智能对话
              <RiArrowRightLine className="size-4" />
            </Link>
          </Button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            换个账号
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <Web2SignIn />

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        或
        <span className="h-px flex-1 bg-border" />
      </div>

      {isConnected ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-full border bg-muted/40 py-1.5 pr-2 pl-4">
            <span className="font-mono text-xs text-foreground">{shortAddress(address)}</span>
            <button
              type="button"
              onClick={() => open({ view: "Connect" })}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RiLoopRightLine className="size-3.5" />
              换一个
            </button>
          </div>
          <Button
            type="button"
            onClick={() => {
              setPending(true)
              void signIn().finally(() => setPending(false))
            }}
            disabled={pending}
            className="h-11 w-full rounded-full text-sm font-bold"
          >
            {pending ? (
              <>
                <RiLoader4Line className="size-4 animate-spin" />
                等待钱包确认…
              </>
            ) : (
              <>
                <RiShieldKeyholeLine className="size-4" />
                签署并登入
              </>
            )}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          onClick={() => open({ view: "Connect" })}
          variant="outline"
          className="h-11 w-full rounded-full text-sm font-medium"
        >
          <RiWallet3Line className="size-4" />
          用钱包登入
        </Button>
      )}

      {error ? (
        <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs leading-5">
          <RiErrorWarningLine className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-foreground">登录未完成</p>
            <p className="mt-0.5 text-muted-foreground">{error}</p>
          </div>
        </div>
      ) : null}

      <details className="group text-xs leading-5 text-muted-foreground">
        <summary className="cursor-pointer list-none text-center underline-offset-4 hover:text-foreground hover:underline">
          关于这次签名
        </summary>
        <div className="mt-3 space-y-2 rounded-2xl bg-muted/40 p-3.5">
          <p>签名只用于验证你持有该账户，不发起链上交易、不产生 gas、不授权任何资产转移。</p>
          <p>支持 MetaMask、Rabby 等浏览器钱包与硬件钱包，也就是你持有私钥的普通账户。</p>
        </div>
      </details>
    </div>
  )
}
