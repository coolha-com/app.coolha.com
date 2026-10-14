"use client"

import { Popover } from "@base-ui/react/popover"
import { CAPABILITY_META } from "./capability-meta"
import { CapabilityBadges } from "./CapabilityBadges"
import type { ComputeModel } from "@/lib/compute/types"
import { cn } from "@/lib/utils"

/**
 * 能力列：默认只显示前 N 个标签，鼠标悬浮（或键盘聚焦）展开完整能力清单。
 * 用 Portal 渲染浮层——表格容器有 overflow-x-auto，普通绝对定位会被裁切。
 */
export function CapabilityPopover({
  model,
  tags,
  max = 3,
}: {
  model: ComputeModel
  tags: string[]
  max?: number
}) {
  if (tags.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={180}
        closeDelay={120}
        aria-label={`查看 ${model.name} 的全部能力`}
        className="flex max-w-full cursor-default items-center gap-1 rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <CapabilityBadges tags={tags} max={max} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} side="top" align="start" className="z-50">
          <Popover.Popup className="w-72 rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl outline-none">
            <p className="text-xs font-medium text-muted-foreground">
              {model.name} · 全部能力（{tags.length}）
            </p>
            <ul className="mt-2 space-y-1.5">
              {tags.map((tag) => {
                const meta = CAPABILITY_META[tag]
                if (!meta) return null
                const Icon = meta.icon
                return (
                  <li key={tag} className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-px inline-flex shrink-0 items-center justify-center rounded-md border p-1",
                        tag === "free"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Icon className="size-3" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="text-xs font-medium">{meta.label}</span>
                      <span className="block text-[11px] leading-4 text-muted-foreground">
                        {meta.hint}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
            {model.modalities ? (
              <p className="mt-2.5 border-t pt-2 text-[11px] leading-4 text-muted-foreground">
                输入模态：{model.modalities.input.join(" / ") || "—"}
                <br />
                输出模态：{model.modalities.output.join(" / ") || "—"}
              </p>
            ) : null}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
