"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { RiLogoutBoxLine, RiLoader4Line } from "react-icons/ri"

import { PageHeader, PageShell, SectionHeading, Surface } from "@/components/PageShell"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { EmailCard } from "./EmailCard"
import { PasswordCard } from "./PasswordCard"
import { ProfileCard } from "./ProfileCard"
import { WalletsCard } from "./WalletsCard"
import type { AccountSnapshot } from "./types"

export function AccountDesk({ account }: { account: AccountSnapshot }) {
  const router = useRouter()
  const { signOut } = useAuth()
  const [pending, setPending] = useState(false)

  async function logout() {
    setPending(true)
    try {
      await signOut()
      router.replace("/chat")
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="账户"
        description="资料、登录方式与安全设置。一个账号下可以同时绑定邮箱与多个钱包，它们共享同一份权益与用量。"
      />

      <SectionHeading className="mt-0">资料</SectionHeading>
      <ProfileCard
        displayName={account.displayName}
        email={account.email}
        image={account.image}
        fallbackLabel={account.fallbackLabel}
      />

      <SectionHeading>登录方式</SectionHeading>
      <div className="space-y-3">
        <EmailCard
          email={account.email}
          emailVerified={account.emailVerified}
          hasNeonAuth={account.hasNeonAuth}
        />
        <PasswordCard hasPassword={account.hasPassword} hasNeonAuth={account.hasNeonAuth} />
        <WalletsCard
          wallets={account.wallets}
          hasNonWalletCredential={account.hasNonWalletCredential}
          currentAddress={account.currentAddress}
        />
      </div>

      <SectionHeading>会话</SectionHeading>
      <Surface className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            当前通过{account.source === "web2" ? "邮箱 / 社交账号" : "钱包签名"}登入
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            登出只清掉这台设备上的会话，不影响已绑定的登录方式。
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void logout()}
          disabled={pending}
          className="h-9 shrink-0 rounded-full px-4 text-xs font-medium"
        >
          {pending ? (
            <RiLoader4Line className="size-4 animate-spin" />
          ) : (
            <RiLogoutBoxLine className="size-4" />
          )}
          登出
        </Button>
      </Surface>
    </PageShell>
  )
}
