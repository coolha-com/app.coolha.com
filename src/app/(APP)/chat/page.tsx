import type { Metadata } from "next";
import { PlaygroundChat } from "@/components/compute/PlaygroundChat";
import { getPlaygroundModels } from "@/lib/ai-gateway/playground";
import { isAiGatewayConfigured } from "@/lib/ai-gateway/client";
import { MockNotice } from "@/components/compute/MockNotice";

export const metadata: Metadata = {
  title: "Chat",
  description: "AI 对话：模型切换、深度思考、图片理解与多连接",
}

export const revalidate = 3600;

/** Chat 主界面：占满内容区的全高对话工作台 */
export default async function PlaygroundPage() {
  const configured = isAiGatewayConfigured()
  const { models, defaultSlug } = await getPlaygroundModels()

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      {configured ? null : (
        <MockNotice className="m-3 mb-0">
          未检测到 AI_GATEWAY_API_KEY：免费模型通道不可用，你仍可在「API 连接」中添加自己的模型服务。
        </MockNotice>
      )}
      <PlaygroundChat models={models} defaultSlug={defaultSlug} />
    </section>
  );
}
