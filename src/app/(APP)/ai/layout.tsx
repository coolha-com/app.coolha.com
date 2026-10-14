import type { ReactNode } from "react"
import { RiInformationLine } from "react-icons/ri"
import { ComputeSubNav } from "@/components/compute/ComputeSubNav"

/**
 * 算力市场模块布局：模块头 + 数据状态说明 + 子导航。
 * 说明按模块整体口径描述：模型目录已接入 Vercel AI Gateway 真实数据，
 * 其余（API Key / 额度 / 账单 / 用量）仍为演示数据，各页面另有局部提示。
 */
export default function ComputeLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-normal">算力市场</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            聚合 AI 模型 API 与推理服务的交易市场：发现服务、比较价格、测试模型、购买额度，并通过稳定币结算。
          </p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">模型目录 · 已接入 AI Gateway</p>
      </header>

      <div className="mt-6 flex items-start gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <RiInformationLine className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="leading-6">
          模型目录、价格与规格来自 Vercel AI Gateway 公开模型目录（供应商报告口径，每小时同步）；
          Playground 为真实推理，用量记录为真实调用数据；API
          Key、额度与账单模块仍处于演示状态，相关卡片带有「示例数据」标识。
        </p>
      </div>

      <ComputeSubNav />
      {children}
    </main>
  )
}
