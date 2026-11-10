import type { ReactNode } from "react"
import Link from "next/link"
import type { IconType } from "react-icons"
import {
  RiArrowRightLine,
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiInformationLine,
} from "react-icons/ri"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * 主导航落地页的 radix-luma 版式基元。
 *
 * 与 components.json 对齐：neutral 基色 + cssVariables、remixicon 图标库、
 * 菜单 default 底色 / subtle 弱强调（悬停与激活统一走 muted，不用 primary 色块）。
 * 圆角统一跟随组件库的 rounded-4xl。
 *
 * 这些组件只负责版式，不承载任何业务逻辑、权限判断或业务文案。
 */

/** 页面容器：沿用主导航页原有的 max-w-3xl 宽度，避免改动既有布局 */
export function PageShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6",
        className,
      )}
    >
      {children}
    </div>
  )
}

/** 统一页头：标题 + 说明；说明允许内嵌链接，故类型为 ReactNode */
export function PageHeader({
  title,
  description,
  eyebrow,
  children,
}: {
  title: string
  description?: ReactNode
  eyebrow?: string
  children?: ReactNode
}) {
  return (
    <header className="mb-7">
      {eyebrow ? (
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-heading text-2xl font-semibold tracking-normal">{title}</h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {children}
    </header>
  )
}

/**
 * 入口卡片：Card + outline 按钮 + 状态徽章。
 * muted 用于「未上线 / 不可进入」的条目，虚线边框 + 次级文字，不暗示可用。
 */
export function EntryCard({
  title,
  description,
  href,
  hrefLabel = "打开",
  icon: Icon,
  status,
  muted = false,
}: {
  title: string
  description?: ReactNode
  href?: string
  hrefLabel?: string
  icon?: IconType
  status?: string
  muted?: boolean
}) {
  return (
    <Card
      size="sm"
      className={cn(
        "gap-3",
        muted && "border border-dashed bg-transparent shadow-none ring-0",
      )}
    >
      <CardHeader>
        <CardTitle
          className={cn("flex items-center gap-2", muted && "text-muted-foreground")}
        >
          {Icon ? (
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : null}
          <span>{title}</span>
        </CardTitle>
        {status ? (
          <CardAction>
            <Badge variant={muted ? "outline" : "secondary"} className="gap-1">
              {muted ? (
                <RiErrorWarningLine aria-hidden="true" />
              ) : (
                <RiCheckboxCircleLine aria-hidden="true" />
              )}
              {status}
            </Badge>
          </CardAction>
        ) : null}
        {description ? (
          <CardDescription className="leading-6">{description}</CardDescription>
        ) : null}
      </CardHeader>
      {href ? (
        <CardFooter>
          <Button asChild variant="outline" size="sm">
            <Link href={href}>
              {hrefLabel}
              <RiArrowRightLine className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  )
}

/** 轻量面板：记录行、代码块、列表容器等，统一 4xl 圆角与 subtle 描边 */
export function Surface({
  children,
  className,
  as = "div",
}: {
  children: ReactNode
  className?: string
  as?: "div" | "li" | "ol" | "section"
}) {
  const classes = cn(
    "rounded-4xl bg-card px-4 py-3 text-sm shadow-sm ring-1 ring-foreground/5",
    className,
  )
  if (as === "li") return <li className={classes}>{children}</li>
  if (as === "ol") return <ol className={classes}>{children}</ol>
  if (as === "section") return <section className={classes}>{children}</section>
  return <div className={classes}>{children}</div>
}

export function SectionHeading({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h2 className={cn("mb-3 mt-8 text-base font-medium", className)}>{children}</h2>
  )
}

/** 提示条：沿用原有 amber 语义色，仅统一圆角与图标 */
export function Notice({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-4xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm",
        className,
      )}
    >
      <RiInformationLine
        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
      <div>{children}</div>
    </div>
  )
}

/** 正文内联链接：保持原有下划线交互，统一字重 */
export function InlineLink({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn("font-medium underline-offset-4 hover:underline", className)}
    >
      {children}
    </Link>
  )
}

/** 行内代码 */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">
      {children}
    </code>
  )
}
