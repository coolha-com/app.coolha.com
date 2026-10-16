import Link from "next/link"
import { RiArrowRightUpLine, RiExternalLinkLine, RiInformationLine } from "react-icons/ri"
import type { Web3Tool } from "@/lib/web3-tools/types"
import {
  TOOL_ACCESS_LABELS,
  TOOL_CATEGORY_ICONS,
  TOOL_CATEGORY_LABELS,
  TOOL_FORMAT_ICONS,
  TOOL_FORMAT_LABELS,
  TOOL_INTEGRATION_LABELS,
  TOOL_PRIORITY_LABELS,
  TOOL_RISK_LABELS,
} from "@/lib/web3-tools/service"
import { cn } from "@/lib/utils"

/**
 * 接入状态徽章。
 *
 * ⚠️ 这是本页最重要的一个视觉元素：它必须让「生态里有的」与「我们已接入的」
 * 一眼可辨。目前全部工具都是 `none`，页面里不应出现任何暗示可用的措辞。
 */
export function IntegrationBadge({
  integration,
  className,
}: {
  integration: Web3Tool["integration"]
  className?: string
}) {
  const style =
    integration === "live"
      ? "border-primary/40 bg-primary/10 text-primary"
      : integration === "planned"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
        : "border-border bg-muted text-muted-foreground"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        style,
        className,
      )}
    >
      {TOOL_INTEGRATION_LABELS[integration]}
    </span>
  )
}

/**
 * 接入优先级徽章。
 * P0 是我们真的会先动手的那批，用主色；`no` 用灰色，明确表达「评估过，不做」。
 */
function PriorityBadge({ priority }: { priority: Web3Tool["priority"] }) {
  const style =
    priority === "p0"
      ? "border-primary/40 bg-primary/10 text-primary"
      : priority === "no"
        ? "border-border bg-muted/60 text-muted-foreground"
        : "border-border bg-muted text-muted-foreground"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        style,
      )}
    >
      {TOOL_PRIORITY_LABELS[priority]}
    </span>
  )
}

/** 风险级别徽章：写操作类用警示色，页面上最需要被看见的一列 */
function RiskBadge({ risk }: { risk: Web3Tool["risk"] }) {
  const style =
    risk === "write"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      : risk === "simulate"
        ? "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400"
        : "border-border bg-muted text-muted-foreground"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        style,
      )}
    >
      {TOOL_RISK_LABELS[risk]}
    </span>
  )
}

const EXTERNAL = /^https?:/i

/**
 * 单个工具卡片。
 *
 * 设计取舍：标题行只放形态 + 名称 + 接入状态；风险与分类作为元信息；
 * caveats（许可证、服务端持钥等风险）默认折叠，避免 31 张卡片全是警告噪音，
 * 但用「注意事项 N」显式提示存在——不能因为怕刺眼就藏起来。
 */
export function ToolCard({ tool }: { tool: Web3Tool }) {
  const FormatIcon = TOOL_FORMAT_ICONS[tool.format]
  const CategoryIcon = TOOL_CATEGORY_ICONS[tool.category]
  const href = tool.url

  return (
    <article
      id={tool.id}
      className="flex scroll-mt-24 flex-col rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <FormatIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <h3 className="truncate text-sm font-semibold">{tool.name}</h3>
        </div>
        <IntegrationBadge integration={tool.integration} className="shrink-0" />
      </div>

      <p className="mt-2 text-xs leading-5 text-muted-foreground">{tool.summary}</p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={tool.priority} />
        <RiskBadge risk={tool.risk} />
        <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          <CategoryIcon className="size-3.5" aria-hidden />
          {TOOL_CATEGORY_LABELS[tool.category]}
        </span>
        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
          {TOOL_FORMAT_LABELS[tool.format]}
        </span>
        {tool.toolCount ? (
          <span className="rounded-full border px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
            {tool.toolCount} 个工具
          </span>
        ) : null}
        {tool.license ? (
          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            {tool.license}
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        接入方式：{TOOL_ACCESS_LABELS[tool.access]}
        {tool.plannedPhase ? ` · 计划 Phase ${tool.plannedPhase}` : " · 暂无排期"}
      </p>

      {tool.chains.length > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">支持：{tool.chains.join(" · ")}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {tool.requiresSignature ? (
          <span className="text-amber-600 dark:text-amber-400">需钱包签名</span>
        ) : (
          <span className="text-muted-foreground">无需签名</span>
        )}
        {tool.holdsKeys ? (
          <span className="text-amber-600 dark:text-amber-400">服务端持钥</span>
        ) : (
          <span className="text-muted-foreground">服务端不持钥</span>
        )}
      </div>

      {tool.caveats.length > 0 ? (
        <details className="mt-3 rounded-lg bg-muted/50 px-2.5 py-1.5">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground">
            <RiInformationLine className="size-3.5 shrink-0" aria-hidden />
            注意事项 {tool.caveats.length} 项
          </summary>
          <ul className="mt-1.5 space-y-1">
            {tool.caveats.map((caveat) => (
              <li key={caveat} className="text-xs leading-5 text-muted-foreground">
                · {caveat}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-3 pt-1">
        {EXTERNAL.test(href) ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            官方文档
            <RiExternalLinkLine className="size-3.5" aria-hidden />
          </a>
        ) : (
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            查看详情
            <RiArrowRightUpLine className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </article>
  )
}