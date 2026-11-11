import type { Metadata } from "next";
import { ChatWorkbench } from "@/components/agents/ChatWorkbench";
import { DEFAULT_PLAYGROUND_MODEL_ID, getPlaygroundModels } from "@/lib/ai-gateway/playground";

export const metadata: Metadata = {
  title: "智能对话",
  description: "向 Coolha 的 Agent 派发任务，查看思考过程、工具调用与执行结果。",
};

export const revalidate = 3600;

/**
 * 智能对话 = Agent 执行单一通道。
 * 这里只取统一推理网关 INFERENCE_MODELS 白名单给切换器用，
 * 不提供自带 Key，也不再渲染模型对话 / 免费聊天。
 */
export default async function ChatPage() {
  const catalog = await getPlaygroundModels().catch(() => null)
  const models = catalog?.models ?? []
  const defaultModelId =
    models.find((model) => model.id === catalog?.defaultSlug)?.modelId ??
    models[0]?.modelId ??
    DEFAULT_PLAYGROUND_MODEL_ID

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <ChatWorkbench models={models} defaultModelId={defaultModelId} />
    </section>
  );
}
