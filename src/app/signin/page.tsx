import type { Metadata } from "next"
import Link from "next/link"
import { RiArrowLeftLine } from "react-icons/ri"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SignInFlow } from "@/components/web3/SignInFlow"

export const metadata: Metadata = {
  title: "登入",
  description: "使用邮箱、社交账号或钱包登入 Coolha，无需密码。",
}

/**
 * 全屏登录页。
 * 刻意放在 (APP) 路由组之外：登录不应被侧边栏与内容区包住，
 * 用户看到的是一个独立的、覆盖整个视口的页面。
 */
export default function SignInPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-base-200">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/chat" className="flex items-center gap-2.5">
          <Avatar className="size-8 shrink-0 border">
            <AvatarImage src="/favicon.ico" alt="Coolha" />
            <AvatarFallback>CH</AvatarFallback>
          </Avatar>
          <span className="text-base font-bold tracking-tight">Coolha</span>
        </Link>
        <Link
          href="/chat"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <RiArrowLeftLine className="size-4" />
          返回应用
        </Link>
      </header>

      <div className="flex flex-1 items-start justify-center px-5 pb-20 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-[25rem]">
          <div className="rounded-4xl bg-card px-6 py-7 shadow-sm ring-1 ring-foreground/5 sm:px-8">
            <SignInFlow />
          </div>
        </div>
      </div>
    </main>
  )
}
