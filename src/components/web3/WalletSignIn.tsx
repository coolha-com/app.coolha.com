"use client"

import { RiLogoutBoxRLine, RiShieldCheckLine, RiShieldKeyholeLine } from "react-icons/ri"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { cn } from "@/lib/utils"

/**
 * 侧边栏钱包签名登录状态条。
 * 设计原则：不与 ConnectButton 争视觉权重——未登录时为低调文字按钮，已登录时为静态状态 + 显式退出入口。
 */
export default function WalletSignIn({ className }: { className?: string }) {
  const { signedIn, isConnected, signIn, signOut, error } = useWalletAuth()

  if (!isConnected) return null

  if (signedIn) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center gap-1.5 xl:justify-start",
          className,
        )}
      >
        <RiShieldCheckLine className="size-4 shrink-0 text-primary" />
        <span className="hidden text-xs font-medium text-primary xl:inline">已登录</span>
        <button
          type="button"
          onClick={() => void signOut()}
          title="退出登录"
          className="hidden items-center gap-1 rounded-full px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-destructive xl:inline-flex"
        >
          <RiLogoutBoxRLine className="size-3.5" />
          退出
        </button>
      </div>
    )
  }

  return (
    <div className={cn("flex w-full flex-col items-center gap-1 xl:items-start", className)}>
      <button
        type="button"
        onClick={() => void signIn()}
        title="签名登录"
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <RiShieldKeyholeLine className="size-4 shrink-0" />
        <span className="hidden xl:inline">签名登录</span>
      </button>
      {error ? (
        <p className="px-1 text-[11px] leading-tight text-destructive">{error}</p>
      ) : null}
    </div>
  )
}
