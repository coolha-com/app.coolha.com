import type { ReactNode } from "react"

/**
 * 代币化资产模块布局。
 *
 * 与 /ai（算力市场）保持同一架构：由布局负责容器与模块头，页面只管内容。
 * 这里必须提供横向内边距——侧边栏在 xl 断点占 256px 且为 fixed 定位，
 * 内容区若不带 padding 会紧贴侧边栏，视觉上被压住。
 */
export default function RwaLayout({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">代币化资产</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            流动性分两层：发行方申赎（一级）与 DEX 池（二级）。只做数据与跳转，不撮合、不托管。
          </p>
        </div>
      </header>

      <div className="mt-6">{children}</div>
    </main>
  )
}
