import type { ReactNode } from "react"
import { RiArrowRightSLine } from "react-icons/ri"
import { cn } from "@/lib/utils"

/**
 * 折叠说明条：解释性文字默认收起，只占一行标题。
 * 原生 details 实现，无客户端 JS，RSC 友好。
 * summary 可传一个紧凑的常驻提示（如模型数量），与折叠内容并存。
 */
export function CollapsibleNote({
  title = "说明",
  summary,
  children,
  className,
}: {
  title?: string
  summary?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <details
      className={cn(
        "group rounded-xl border bg-card/60 px-4 py-2.5 transition-colors hover:border-border",
        className,
      )}
    >
      <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <RiArrowRightSLine
          className="size-4 shrink-0 transition-transform group-open:rotate-90"
          aria-hidden
        />
        <span className="shrink-0">{title}</span>
        {summary ? (
          <span className="ml-auto truncate font-normal opacity-80">{summary}</span>
        ) : null}
      </summary>
      <div className="mt-2 space-y-2 pb-1 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
    </details>
  )
}
