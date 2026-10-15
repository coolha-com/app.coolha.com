import type { ReactNode } from "react"
import { ComputeSubNav } from "@/components/compute/ComputeSubNav"
import { ComputeNotes } from "@/components/compute/ComputeNotes"

/**
 * 算力市场模块布局：模块标题 + 子导航 + 内容 + 底部统一说明区。
 * 设计原则：主视觉流只放交互元件；所有模块级解释收敛到底部一个折叠区。
 */
export default function ComputeLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-normal">算力市场</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          聚合 AI 模型 API 与推理服务的交易市场
        </p>
      </header>

      <ComputeSubNav />
      {children}

      <footer className="mt-10 border-t pt-6">
        <ComputeNotes />
      </footer>
    </main>
  )
}
