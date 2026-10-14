"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { RiCheckLine, RiFileCopyLine } from "react-icons/ri"
import { cn } from "@/lib/utils"

/** 复制按钮：剪贴板不可用时静默降级 */
export function CopyButton({
  text,
  label = "复制",
  className,
}: {
  text: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [text])

  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      {copied ? (
        <RiCheckLine className="size-3.5 text-primary" />
      ) : (
        <RiFileCopyLine className="size-3.5" />
      )}
      {copied ? "已复制" : label}
    </button>
  )
}
