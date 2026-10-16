"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

/** 全局错误边界：避免整页白屏 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[coolha] unhandled error:", error)
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="text-xs text-muted-foreground">Coolha</p>
      <h1 className="text-2xl font-semibold">出现了一些问题</h1>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">
        页面遇到了未处理的错误。你可以重试，或返回仪表板。
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">错误标识：{error.digest}</p>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={reset} className="rounded-xl">
          重试
        </Button>
        <Button asChild variant="outline" className="rounded-xl">
          <a href="/chat">返回 Chat</a>
        </Button>
      </div>
    </div>
  )
}
