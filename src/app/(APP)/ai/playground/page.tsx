import type { Metadata } from "next"
import { PlaygroundChat } from "@/components/compute/PlaygroundChat"
import { getPlaygroundModels } from "@/lib/ai-gateway/playground"
import { isAiGatewayConfigured } from "@/lib/ai-gateway/client"
import { MockNotice } from "@/components/compute/MockBadge"

export const metadata: Metadata = {
  title: "Playground",
  description: "在线测试模型：真实流式输出、Token 用量与成本",
}

export const revalidate = 3600

export default async function PlaygroundPage() {
  const configured = isAiGatewayConfigured()
  const { models, defaultSlug, defaultIsFree } = await getPlaygroundModels()

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        {defaultIsFree ? (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
            默认免费模型 · 不产生成本
          </span>
        ) : null}
      </div>

      {configured ? null : (
        <MockNotice className="mt-4">
          未检测到 AI_GATEWAY_API_KEY：Playground 无法发起真实调用，请先在服务端环境变量中配置。
        </MockNotice>
      )}

      <div className="mt-4">
        <PlaygroundChat models={models} defaultSlug={defaultSlug} />
      </div>
    </section>
  )
}
