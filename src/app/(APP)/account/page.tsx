import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { AccountDesk } from "@/components/account/AccountDesk"
import { readAccountOverview } from "@/lib/neon/account"
import { getCurrentUser } from "@/lib/neon/session"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "账户",
  description: "资料、登录方式与安全设置。",
}

/**
 * 用户主页：资料 + 登录方式（邮箱 / 密码 / 钱包）+ 会话。
 *
 * 放在 (APP) 路由组内，因为「点侧边栏头像进来」是站内导航，不该丢掉侧边栏；
 * 而 /signin 是全屏独立路由（未登录时才去）。
 */
export default async function AccountPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/signin")

  const overview = await readAccountOverview({
    neonUserId: user.neonUserId,
    userId: user.userId,
  })

  return (
    <AccountDesk
      account={{
        source: user.source,
        displayName: overview.displayName ?? user.name,
        email: overview.email ?? user.email,
        emailVerified: overview.emailVerified,
        image: overview.avatarUrl ?? user.image,
        hasPassword: overview.hasPassword,
        hasNeonAuth: Boolean(user.neonUserId),
        wallets: overview.wallets,
        hasNonWalletCredential: overview.hasNonWalletCredential,
        currentAddress: user.address,
        fallbackLabel: user.address ? user.address.slice(2, 3).toUpperCase() : "C",
      }}
    />
  )
}