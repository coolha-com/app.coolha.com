import { cn } from "@/lib/utils"

/** 「示例数据」标识徽章：所有 Mock 数据旁必须展示 */
export function MockBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />
      示例数据
    </span>
  )
}
