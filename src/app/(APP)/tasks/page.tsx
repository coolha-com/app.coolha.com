import type { Metadata } from "next"
import Link from "next/link"
import { ResearchRunArticle } from "@/components/agents/ResearchRunArticle"
import { getWalletSessionFromCookies } from "@/lib/neon/wallet-auth"
import { resolveSubject } from "@/lib/neon/identity"
import { listRwaRuns } from "@/lib/neon/rwa-research"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "任务",
  description: "RWA Research 的订单与执行结果。",
}

export default async function TasksPage() {
  const session = await getWalletSessionFromCookies()
  const signedIn = Boolean(session?.address)
  const runs = signedIn && session?.address
    ? await listRwaRuns(await resolveSubject(session.address)).catch(() => [])
    : []

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-normal">任务</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        这里是 RWA Research 的订单和执行结果。标价未公布，付款状态保持未付款。
      </p>
      <p className="mt-2 text-sm">
        <Link href="/agents/rwa-research" className="underline-offset-4 hover:underline">
          去配置 Profile 并提交任务
        </Link>
      </p>
      {!signedIn ? (
        <p className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          查看自己的任务需要先在侧边栏连接钱包并签名登录。
        </p>
      ) : null}
      {signedIn && runs.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">还没有执行记录。</p>
      ) : null}
      <div className="mt-6 space-y-4">
        {runs.map((run) => (
          <ResearchRunArticle key={run.orderId} run={run} />
        ))}
      </div>
    </div>
  )
}
