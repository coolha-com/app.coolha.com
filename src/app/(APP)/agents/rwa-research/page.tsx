import type { Metadata } from "next"
import { ModulePage } from "@/components/compute/ModulePage"
import { RwaResearchDesk } from "@/components/agents/RwaResearchDesk"
import { getPlaygroundModels } from "@/lib/ai-gateway/playground"
import { getCurrentUser } from "@/lib/neon/session"
import { getRwaProfile, listRwaRuns } from "@/lib/neon/rwa-research"
import type { ResearchRunView, SavedProfile } from "@/lib/agents/rwa-research"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "RWA Research",
  description: "可保存配置的只读研究服务。提交任务后查看带来源与时间的报告，以及对应的订单和执行记录。",
}

export default async function RwaResearchPage() {
  const user = await getCurrentUser()
  const signedIn = Boolean(user)

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
  if (user) {
    try {
      profile = await getRwaProfile(user.subject)
      runs = await listRwaRuns(user.subject)
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
