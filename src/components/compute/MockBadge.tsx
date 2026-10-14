import type { ComputeDataSource } from "@/lib/compute/types"
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

const DATA_SOURCE_STYLES: Record<ComputeDataSource, { wrap: string; dot: string; label: string }> = {
  mock: {
    wrap: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    label: "示例数据",
  },
  "provider-reported": {
    wrap: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    dot: "bg-sky-500",
    label: "上游目录",
  },
  realtime: {
    wrap: "border-primary/30 bg-primary/10 text-primary",
    dot: "bg-primary",
    label: "实时探测",
  },
}

/**
 * 数据来源徽章：随每条数据展示其来源，禁止把演示数据伪装成真实数据。
 * provider-reported = 来自 Vercel AI Gateway 公开目录（供应商报告口径，非平台实测）
 */
export function DataSourceBadge({
  source,
  className,
}: {
  source: ComputeDataSource
  className?: string
}) {
  const style = DATA_SOURCE_STYLES[source]
  return (
    <span
      title={
        source === "provider-reported"
          ? "价格与规格来自 Vercel AI Gateway 公开模型目录（供应商报告口径），延迟为实时探测缺失"
          : undefined
      }
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        style.wrap,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  )
}
