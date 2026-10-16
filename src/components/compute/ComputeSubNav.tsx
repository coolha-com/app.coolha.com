"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  RiBankCardLine,
  RiBarChartBoxLine,
  RiCpuLine,
  RiKey2Line,
  RiSearchLine,
  RiToolsLine,
} from "react-icons/ri"
import { cn } from "@/lib/utils"

/**
 * 算力市场子导航：/ai/* 模块内切换。
 *
 * 顺序即信息优先级：Web3 工具 → 投前侦察 → 模型广场 → API 连接 → 用量 → 账单。
 * 不含 /chat —— Chat 是主入口（侧边栏第一项），不需要在算力市场子导航里重复。
 *
 * 图标：优先沿用各模块页面已在用的图标（如投前侦察 = RiSearchLine）；
 * 页面本身没有主图标的，按语义选最接近的 Remix Icon。
 */
const TABS = [
  { href: "/ai/tools", label: "Web3 工具", Icon: RiToolsLine },
  { href: "/ai/research", label: "投前侦察", Icon: RiSearchLine },
  { href: "/ai/models", label: "模型广场", Icon: RiCpuLine },
  { href: "/ai/api-keys", label: "API 连接", Icon: RiKey2Line },
  { href: "/ai/usage", label: "用量记录", Icon: RiBarChartBoxLine },
  { href: "/ai/billing", label: "余额与账单", Icon: RiBankCardLine },
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
        const Icon = tab.Icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
