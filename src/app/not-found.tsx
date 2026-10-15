import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="text-xs text-muted-foreground">Coolha</p>
      <h1 className="text-2xl font-semibold">404 · 页面不存在</h1>
      <p className="max-w-md text-sm leading-6 text-muted-foreground">
        你访问的页面不存在或已被移除。
      </p>
      <div className="flex gap-2">
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-xl border bg-background px-4 text-sm font-medium transition-colors hover:text-foreground"
        >
          返回仪表板
        </Link>
      </div>
    </div>
  )
}
