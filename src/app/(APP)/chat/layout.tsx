import type { ReactNode } from "react"

/**
 * 算力市场模块布局：透传容器，不加标题/导航/说明。
 * Chat 需要占满内容区（自带紧凑工具栏与模块入口）；
 * 其余页面各自使用 <ModulePage> 壳层（标题 + 返回入口 + 底部统一说明）。
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  return <main className="flex min-h-dvh flex-1 flex-col">{children}</main>
}
