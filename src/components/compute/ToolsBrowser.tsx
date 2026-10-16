"use client"

import { useMemo, useState } from "react"
import { RiCheckboxCircleLine } from "react-icons/ri"
import type { IconType } from "react-icons"
import type { ToolCategory, ToolFormat, ToolPriority, ToolRisk, Web3Tool } from "@/lib/web3-tools/types"
import {
  DEFAULT_TOOL_FILTERS,
  TOOL_CATEGORY_ICONS,
  TOOL_CATEGORY_LABELS,
  TOOL_FORMAT_ICONS,
  TOOL_FORMAT_LABELS,
  TOOL_PRIORITY_LABELS,
  TOOL_PRIORITY_ORDER,
  TOOL_RISK_ICONS,
  TOOL_RISK_LABELS,
  filterTools,
  type ToolFilterState,
} from "@/lib/web3-tools/service"
import { FilterSelect, type FilterOption } from "./FilterSelect"
import { ToolCard } from "./ToolCard"
import { cn } from "@/lib/utils"

type SortKey = "priority" | "name" | "risk-desc" | "tools-desc"

const SORT_LABELS: Record<SortKey, string> = {
  priority: "接入优先级",
  name: "名称",
  "risk-desc": "风险从高到低",
  "tools-desc": "工具数从多到少",
}

const RISK_ORDER: Record<ToolRisk, number> = { write: 3, simulate: 2, read: 1 }

/** 接入优先级排序：P0 → P1 → P2 → 不接，同级内按风险高者在前 */
function sortTools(tools: Web3Tool[], key: SortKey): Web3Tool[] {
  const copy = [...tools]
  switch (key) {
    case "priority":
      return copy.sort(
        (a, b) =>
          TOOL_PRIORITY_ORDER[a.priority] - TOOL_PRIORITY_ORDER[b.priority] ||
          RISK_ORDER[b.risk] - RISK_ORDER[a.risk] ||
          a.name.localeCompare(b.name),
      )
    case "risk-desc":
      return copy.sort((a, b) => RISK_ORDER[b.risk] - RISK_ORDER[a.risk] || a.name.localeCompare(b.name))
    case "tools-desc":
      return copy.sort((a, b) => (b.toolCount ?? 0) - (a.toolCount ?? 0) || a.name.localeCompare(b.name))
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name))
  }
}

function optionWithIcon(label: string, Icon: IconType) {
  return {
    label,
    icon: <Icon className="size-3.5 text-muted-foreground" aria-hidden />,
  }
}

/**
 * Web3 工具浏览器。
 *
 * 默认排序是「接入优先级」而不是名称——这个页面要回答的是
 * 「Coolha 打算先接哪些、为什么」，而不是「生态里有什么」。
 * 优先级筛选是主筛选条件，其余（形态/ 分类 / 风险）用于探索。
 */
export function ToolsBrowser({ tools }: { tools: Web3Tool[] }) {
  const [filters, setFilters] = useState<ToolFilterState>(DEFAULT_TOOL_FILTERS)
  const [sort, setSort] = useState<SortKey>("priority")

  const formatOptions = useMemo<FilterOption[]>(
    () => [
      { value: "all", label: "全部形态" },
      ...(Object.keys(TOOL_FORMAT_LABELS) as ToolFormat[]).map((value) => ({
        value,
        ...optionWithIcon(TOOL_FORMAT_LABELS[value], TOOL_FORMAT_ICONS[value]),
      })),
    ],
    [],
  )

  const categoryOptions = useMemo<FilterOption[]>(
    () => [
      { value: "all", label: "全部分类" },
      ...(Object.keys(TOOL_CATEGORY_LABELS) as ToolCategory[]).map((value) => ({
        value,
        ...optionWithIcon(TOOL_CATEGORY_LABELS[value], TOOL_CATEGORY_ICONS[value]),
      })),
    ],
    [],
  )

  const riskOptions = useMemo<FilterOption[]>(
    () => [
      { value: "all", label: "全部风险" },
      ...(Object.keys(TOOL_RISK_LABELS) as ToolRisk[]).map((value) => ({
        value,
        ...optionWithIcon(TOOL_RISK_LABELS[value], TOOL_RISK_ICONS[value]),
      })),
    ],
    [],
  )

  const priorityOptions = useMemo<FilterOption[]>(
    () => [
      { value: "all", label: "全部优先级" },
      ...(Object.keys(TOOL_PRIORITY_LABELS) as ToolPriority[]).map((value) => ({
        value,
        label: TOOL_PRIORITY_LABELS[value],
      })),
    ],
    [],
  )

  const sortOptions = useMemo<FilterOption[]>(
    () =>
      (Object.keys(SORT_LABELS) as SortKey[]).map((value) => ({
        value,
        label: SORT_LABELS[value],
      })),
    [],
  )

  const visible = useMemo(() => sortTools(filterTools(tools, filters), sort), [tools, filters, sort])

  return (
    <div className="mt-6">
      {/* 优先级分布：一眼看清「先接什么、不接什么」 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(["p0", "p1", "p2", "no"] as ToolPriority[]).map((key) => {
          const count = tools.filter((t) => t.priority === key).length
          const active = filters.priority === key
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() =>
                setFilters((prev) => ({ ...prev, priority: active ? "all" : key }))
              }
              className={cn(
                "rounded-2xl border p-3 text-left transition-colors",
                active ? "border-primary bg-primary/5" : "bg-card hover:border-primary/40",
              )}
            >
              <span className="text-xs text-muted-foreground">{TOOL_PRIORITY_LABELS[key]}</span>
              <span className="mt-0.5 block text-xl font-semibold tabular-nums">{count}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="search"
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="搜索工具名称、能力或链"
            aria-label="搜索工具"
            className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:max-w-72"
          />
          <div className="flex flex-wrap gap-2">
            <FilterSelect
              label="接入优先级"
              value={filters.priority}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, priority: value as ToolFilterState["priority"] }))
              }
              options={priorityOptions}
            />
            <FilterSelect
              label="工具形态"
              value={filters.format}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, format: value as ToolFilterState["format"] }))
              }
              options={formatOptions}
            />
            <FilterSelect
              label="能力分类"
              value={filters.category}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, category: value as ToolFilterState["category"] }))
              }
              options={categoryOptions}
            />
            <FilterSelect
              label="风险级别"
              value={filters.risk}
              onChange={(value) =>
                setFilters((prev) => ({ ...prev, risk: value as ToolFilterState["risk"] }))
              }
              options={riskOptions}
            />
            <FilterSelect
              label="排序方式"
              value={sort}
              onChange={(value) => setSort(value as SortKey)}
              options={sortOptions}
              triggerClassName="min-w-40"
            />
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_TOOL_FILTERS)}
              className="h-9 rounded-lg border bg-background px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              重置
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={filters.signatureOnly}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, signatureOnly: event.target.checked }))
              }
              className="size-3.5 accent-[var(--primary)]"
            />
            只看需要钱包签名的
          </label>
          <p className="text-xs text-muted-foreground">
            共 {visible.length} / {tools.length} 个工具
          </p>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed bg-card p-10 text-center">
          <RiCheckboxCircleLine className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            没有符合当前筛选条件的工具，请调整筛选或重置。
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      )}
    </div>
  )
}