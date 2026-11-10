import type { Metadata } from "next"
import { ModulePage } from "@/components/compute/ModulePage"
import { RwaResearchDesk } from "@/components/agents/RwaResearchDesk"
import { getPlaygroundModels } from "@/lib/ai-gateway/playground"
import { getWalletSessionFromCookies } from "@/lib/neon/wallet-auth"
import { resolveSubject } from "@/lib/neon/identity"
import { getRwaProfile, listRwaRuns } from "@/lib/neon/rwa-research"
import type { ResearchRunView, SavedProfile } from "@/lib/agents/rwa-research"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "RWA Research",
  description: "可保存配置的只读研究服务。提交任务后查看带来源与时间的报告，以及对应的订单和执行记录。",
}

export default async function RwaResearchPage() {
  const session = await getWalletSessionFromCookies()
  const signedIn = Boolean(session?.address)

  let models: { slug: string; name: string; providerName: string }[] = []
  try {
    const playground = await getPlaygroundModels()
    models = playground.models.map((model) => ({
      slug: model.id,
      name: model.name,
      providerName: model.providerName,
    }))
  } catch {
    models = []
  }

  let profile: SavedProfile | null = null
  let runs: ResearchRunView[] = []
  if (signedIn && session?.address) {
    try {
      const subject = await resolveSubject(session.address)
      profile = await getRwaProfile(subject)
      runs = await listRwaRuns(subject)
    } catch {
      profile = null
      runs = []
    }
  }

  return (
    <ModulePage
      title="RWA Research"
      description="一项可保存配置的只读研究服务。提交任务后生成订单和执行记录，页面只展示这次实际取到的事实、数据来源和抓取时间。"
    >
      <RwaResearchDesk
        signedIn={signedIn}
        models={models}
        initialProfile={profile}
        initialRuns={runs}
      />
    </ModulePage>
  )
}
