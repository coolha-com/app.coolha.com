"use client"

import { CAPABILITY_META } from "./capability-meta"
import { cn } from "@/lib/utils"

/** 能力标签组：图标 + 文字。超出 max 时折叠为 +N */
export function CapabilityBadges({
  tags,
  max = 4,
  className,
}: {
  tags: string[]
  max?: number
  className?: string
}) {
  if (tags.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const shown = tags.slice(0, max)
  const rest = tags.length - shown.length

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((tag) => {
        const meta = CAPABILITY_META[tag]
        if (!meta) return null
        const Icon = meta.icon
        const highlighted = tag === "free"
        return (
          <span
            key={tag}
            title={meta.hint}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
              highlighted
                ? "border-primary/40 bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-3 shrink-0" aria-hidden />
            {meta.label}
          </span>
        )
      })}
      {rest > 0 ? (
        <span
          className="text-[11px] text-muted-foreground"
          title={tags.slice(max).map((tag) => CAPABILITY_META[tag]?.label ?? tag).join("、")}
        >
          +{rest}
        </span>
      ) : null}
    </div>
  )
}
