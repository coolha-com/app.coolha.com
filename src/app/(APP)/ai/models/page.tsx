import type { Metadata } from "next"
import { ModelsBrowser } from "@/components/compute/ModelsBrowser"
import { MockNotice } from "@/components/compute/MockNotice"
import { ModulePage } from "@/components/compute/ModulePage"
import { getModelCatalog, toListModel } from "@/lib/ai-gateway/client"

export const metadata: Metadata = {
  title: "模型广场",
  description: "搜索、筛选并比较 AI 模型的价格、能力与上下文窗口，数据取自 Vercel AI Gateway 公开模型目录。",
}

/** 目录每 1 小时回源一次（段配置需字面量，与 CATALOG_REVALIDATE_SECONDS 一致） */
export const revalidate = 3600

export default async function ModelsPage() {
  const catalog = await getModelCatalog()
  const isLive = catalog.source === "ai-gateway"

  return (
    <ModulePage
      title="模型广场"
      description="按类型、供应商、价格与能力筛选，点击卡片查看详情与计费规则。"
    >
      {isLive ? null : (
        <MockNotice className="mb-4">
          上游模型目录当前不可用（{catalog.error ?? "UNKNOWN"}），已回退到 Phase 1
          演示目录：以下模型、价格、状态均为示例数据，不代表真实供应商报价。
        </MockNotice>
      )}

      <ModelsBrowser
        models={catalog.models.map(toListModel)}
        providers={catalog.providers}
      />
    </ModulePage>
  )
}
