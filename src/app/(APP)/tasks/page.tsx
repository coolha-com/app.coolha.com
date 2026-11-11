import type { Metadata } from "next"
import Link from "next/link"
import { RiAddLine } from "react-icons/ri"
import { ResearchRunArticle } from "@/components/agents/ResearchRunArticle"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/neon/session"
import { listRwaRuns } from "@/lib/neon/rwa-research"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "历史任务",
  description: "RWA Research 的历史任务与执行结果。",
}

export default async function TasksPage() {
  const user = await getCurrentUser()
  const signedIn = Boolean(user)
  const runs = signedIn && user
    ? await listRwaRuns(user.subject).catch(() => [])
    : []

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-normal">历史任务</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/chat">
            <RiAddLine className="size-4" />
            新建任务
          </Link>
        </Button>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        这里是 RWA Research 的订单和执行结果。要派新任务，请回到智能对话。标价未公布，付款状态保持未付款。
      </p>
      <p className="mt-2 text-sm">
        <Link href="/agents/rwa-research" className="underline-offset-4 hover:underline">
          去配置 Profile 并提交任务
        </Link>
      </p>
      {!signedIn ? (
        <p className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          查看自己的任务需要先在<Link href="/signin" className="underline underline-offset-4">登入</Link>。
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
