import type { Metadata } from "next"
import { ModelsBrowser } from "@/components/compute/ModelsBrowser"
import { MockNotice } from "@/components/compute/MockBadge"
import { CATALOG_REVALIDATE_SECONDS, getModelCatalog, toListModel } from "@/lib/ai-gateway/client"

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
    <section className="mt-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">模型广场</h2>
        <p className="text-sm text-muted-foreground">
          按类型、供应商、价格与能力筛选，点击卡片查看详情与 API 示例。
        </p>
      </div>

      {isLive ? (
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-sm text-sky-700 dark:text-sky-300">
          <p>
            数据来源：Vercel AI Gateway 公开模型目录（供应商报告口径），共 {catalog.models.length}{" "}
            个模型，每 {CATALOG_REVALIDATE_SECONDS / 60} 分钟同步一次。
          </p>
          <p className="text-xs opacity-80">
            价格与上下文为上游目录值，延迟不做展示（平台未实测）。实时调取请访问{" "}
            <code className="font-mono">/api/v1/models</code>。
          </p>
        </div>
      ) : (
        <MockNotice className="mt-4">
          上游模型目录当前不可用（{catalog.error ?? "UNKNOWN"}），已回退到 Phase 1
          演示目录：以下模型、价格、状态均为示例数据，不代表真实供应商报价。
        </MockNotice>
      )}

      <ModelsBrowser
        models={catalog.models.map(toListModel)}
        providers={catalog.providers}
      />
    </section>
  )
}
