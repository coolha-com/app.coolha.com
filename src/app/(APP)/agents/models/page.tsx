import type { Metadata } from "next"
import { ModelsBrowser } from "@/components/compute/ModelsBrowser"
import { MockNotice } from "@/components/compute/MockNotice"
import { ModulePage } from "@/components/compute/ModulePage"
import { getModelCatalog, toListModel } from "@/lib/ai-gateway/client"

export const metadata: Metadata = {
  title: "模型广场",
  description: "模型目录布局演示。推理网关接入后，这里将展示所接网关的模型与价格。",
}

/** 布局页固定 1 小时重生成（不再有上游回源） */
export const revalidate = 3600

export default async function ModelsPage() {
  const catalog = await getModelCatalog()

  return (
    <ModulePage
      title="模型广场"
      description="只列出服务端白名单里的模型。价格来自 OpenRouter 目录，没有就显示未提供。"
    >
      {catalog.models.length === 0 ? (
        <MockNotice className="mb-4">
          还没有配置 INFERENCE_MODELS。这里不会展示演示模型和演示价格。
        </MockNotice>
      ) : catalog.stale ? (
        <MockNotice className="mb-4">
          白名单里的模型 ID 可以调用，但 OpenRouter 目录暂时没有返回规格。
          价格、延迟和评分显示为未提供，不是示例报价。
        </MockNotice>
      ) : null}

      <ModelsBrowser
        models={catalog.models.map(toListModel)}
        providers={catalog.providers}
      />
    </ModulePage>
  )
}
