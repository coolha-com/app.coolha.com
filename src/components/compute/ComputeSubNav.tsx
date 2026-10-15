"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TABS = [
  { href: "/ai/models", label: "模型广场" },
  { href: "/chat", label: "Chat" },
  { href: "/ai/api-keys", label: "API 连接" },
  { href: "/ai/usage", label: "用量记录" },
  { href: "/ai/billing", label: "余额与账单" },
]

/** 算力市场子导航：/ai/* 模块内切换 */
export function ComputeSubNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="算力市场导航"
      className="-mx-4 mt-6 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
    >
      {TABS.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
