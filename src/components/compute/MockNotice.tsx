import { MockBadge } from "./MockBadge"
import { cn } from "@/lib/utils"

/** 页面级 Mock 提示条 */
export function MockNotice({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <span>
        {children ??
          "当前为 Phase 1 演示模式：模型、价格、延迟、状态均为示例数据，不代表真实供应商报价。"}
      </span>
      <MockBadge className="shrink-0" />
    </div>
  )
}
