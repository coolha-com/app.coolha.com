import type { Metadata } from "next"
import { ConnectionsManager } from "@/components/compute/ConnectionsManager"
import { ModulePage } from "@/components/compute/ModulePage"

export const metadata: Metadata = {
  title: "API 连接",
  description: "管理你自己的模型服务连接：OpenAI、DeepSeek、OpenRouter、Ollama 等 OpenAI 兼容端点",
}

export default function ApiKeysPage() {
  return (
    <ModulePage
      title="API 连接"
      description="添加你自己的模型服务，Playground 会直接用它们对话。密钥只保存在你的浏览器。"
    >
      <ConnectionsManager />
    </ModulePage>
  )
}
