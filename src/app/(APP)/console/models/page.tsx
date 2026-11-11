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
      description="按类型、供应商、价格与能力筛选。布局保留，接入推理网关后替换数据源。"
    >
      <MockNotice className="mb-4">
        推理网关未接入（INFERENCE_NOT_CONFIGURED）：以下模型、价格、状态均为
        Phase 1 示例布局数据，不代表任何真实供应商报价，也不可用于推理。
        在 <code className="font-mono">.env.local</code> 配置 INFERENCE_* 并接入带目录接口的网关后，
        这里才会展示真实目录。
      </MockNotice>

      <ModelsBrowser
        models={catalog.models.map(toListModel)}
        providers={catalog.providers}
      />
    </ModulePage>
  )
}
