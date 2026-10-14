import type { ComputeServiceStatus } from "@/lib/compute/types"
import { SERVICE_STATUS_LABELS } from "@/lib/compute/service"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<ComputeServiceStatus, { dot: string; text: string }> = {
  online: { dot: "bg-primary", text: "text-primary" },
  degraded: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  maintenance: { dot: "bg-sky-500", text: "text-sky-600 dark:text-sky-400" },
  unknown: { dot: "bg-muted-foreground", text: "text-muted-foreground" },
}

export function StatusBadge({
  status,
  className,
}: {
  status: ComputeServiceStatus
  className?: string
}) {
  const style = STATUS_STYLES[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium",
        style.text,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", style.dot)} />
      {SERVICE_STATUS_LABELS[status]}
    </span>
  )
}
