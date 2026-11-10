import type { Metadata } from "next"
import Link from "next/link"
import { ConsoleDesk } from "@/components/agents/ConsoleDesk"
import { getWalletSessionFromCookies } from "@/lib/neon/wallet-auth"
import { resolveSubject } from "@/lib/neon/identity"
import { listAgentApiKeys } from "@/lib/agents/api-keys"
import { listRwaRuns } from "@/lib/neon/rwa-research"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "控制台",
  description: "API Key、任务记录和运行状态。",
}

export default async function ConsolePage() {
  const session = await getWalletSessionFromCookies()
  const signedIn = Boolean(session?.address)
  const subject = signedIn && session?.address ? await resolveSubject(session.address).catch(() => null) : null
  const keys = subject ? await listAgentApiKeys(subject).catch(() => []) : []
  const runs = subject ? await listRwaRuns(subject, 20).catch(() => []) : []

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-normal">控制台</h1>
      <p className="mt-2 mb-6 text-sm leading-6 text-muted-foreground">
        管理 API Key，并查看这项研究服务的任务状态。外部请求的权限只来自 Key，不来自这个页面的登录。
        订单与执行结果在 <Link href="/tasks" className="underline-offset-4 hover:underline">任务</Link>。
      </p>
      <ConsoleDesk signedIn={signedIn && Boolean(subject)} initialKeys={keys} initialRuns={runs} />
    </div>
  )
}
