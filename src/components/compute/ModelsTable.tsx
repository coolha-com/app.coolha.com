"use client"

import Link from "next/link"
import {
  RiArrowDownLine,
  RiArrowRightLine,
  RiArrowUpDownLine,
  RiArrowUpLine,
  RiStarFill,
  RiStarLine,
} from "react-icons/ri"
import type { ComputeModel, ModelSort } from "@/lib/compute/types"
import {
  MODEL_TYPE_LABELS,
  formatPricePerMillion,
  formatTokens,
  nextSortForColumn,
  type SortableColumn,
} from "@/lib/compute/service"
import { CapabilityPopover } from "./CapabilityPopover"
import { ProviderLogo } from "./ProviderLogo"
import { StatusBadge } from "./StatusBadge"
import { MODEL_TYPE_ICONS, modelCapabilityTags } from "./capability-meta"
import { cn } from "@/lib/utils"

/** 当前排序键落在哪一列（用于表头高亮与箭头方向） */
function columnOfSort(sort: ModelSort): SortableColumn | null {
  if (sort === "context-desc" || sort === "context-asc") return "context"
  if (sort === "price-asc" || sort === "price-desc") return "inputPrice"
  if (sort === "output-price-asc" || sort === "output-price-desc") return "outputPrice"
  return null
}

function SortIcon({ active, direction }: { active: boolean; direction: "asc" | "desc" }) {
  if (!active) return <RiArrowUpDownLine className="size-3.5 opacity-40" aria-hidden />
  const Icon = direction === "asc" ? RiArrowUpLine : RiArrowDownLine
  return <Icon className="size-3.5 text-primary" aria-hidden />
}

function SortableHeader({
  column,
  label,
  sort,
  onSortChange,
  align = "right",
}: {
  column: SortableColumn
  label: string
  sort: ModelSort
  onSortChange: (sort: ModelSort) => void
  align?: "left" | "right"
}) {
  const active = columnOfSort(sort) === column
  const direction = sort.endsWith("-asc") ? ("asc" as const) : ("desc" as const)

  return (
    <th
      scope="col"
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className={cn("px-4 py-2.5 font-medium", align === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={() => onSortChange(nextSortForColumn(column, sort))}
        title={`按${label}排序（点击切换从多到少 / 从少到多）`}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
          active && "text-foreground",
        )}
      >
        {label}
        <SortIcon active={active} direction={direction} />
      </button>
    </th>
  )
}

/**
 * 模型列表表格视图（对齐 vercel.com/ai-gateway/models 的信息密度）：
 * 模型 Logo + 名称 / 供应商 Logo + 名称 / 能力图标（悬浮展开）/ 上下文 / 输入价 / 输出价 / 详情。
 * 上下文与价格列可点击表头切换升降序。
 */
export function ModelsTable({
  models,
  sort,
  onSortChange,
  favorites = [],
  onToggleFavorite,
}: {
  models: ComputeModel[]
  sort: ModelSort
  onSortChange: (sort: ModelSort) => void
  favorites?: string[]
  onToggleFavorite?: (id: string) => void
}) {
  if (models.length === 0) return null

  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border bg-card shadow-sm">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">
              模型
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              供应商
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              能力
            </th>
            <SortableHeader
              column="context"
              label="上下文"
              sort={sort}
              onSortChange={onSortChange}
            />
            <SortableHeader
              column="inputPrice"
              label="输入 / 百万"
              sort={sort}
              onSortChange={onSortChange}
            />
            <SortableHeader
              column="outputPrice"
              label="输出 / 百万"
              sort={sort}
              onSortChange={onSortChange}
            />
            <th scope="col" className="px-4 py-2.5 text-right font-medium">
              <span className="sr-only">操作</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {models.map((model) => {
            const TypeIcon = MODEL_TYPE_ICONS[model.type]
            const isFavorite = favorites.includes(model.id)
            return (
              <tr key={model.id} className="transition-colors hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <ProviderLogo
                      providerId={model.providerId}
                      providerName={model.providerName}
                      size={24}
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/ai/models/${model.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {model.name}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded border bg-muted px-1 py-px text-[10px] font-medium text-muted-foreground">
                          <TypeIcon className="size-2.5" aria-hidden />
                          {MODEL_TYPE_LABELS[model.type]}
                        </span>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                          {model.modelId}
                        </p>
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ProviderLogo
                      providerId={model.providerId}
                      providerName={model.providerName}
                      size={16}
                    />
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {model.providerName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <CapabilityPopover model={model} tags={modelCapabilityTags(model)} max={3} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {model.contextLength > 0 ? formatTokens(model.contextLength) : "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatPricePerMillion(model.inputPricePerMillionUsd)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatPricePerMillion(model.outputPricePerMillionUsd)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {model.status !== "online" ? <StatusBadge status={model.status} /> : null}
                    {onToggleFavorite ? (
                      <button
                        type="button"
                        aria-label={isFavorite ? `取消收藏 ${model.name}` : `收藏 ${model.name}`}
                        aria-pressed={isFavorite}
                        onClick={() => onToggleFavorite(model.id)}
                        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:text-primary"
                      >
                        {isFavorite ? (
                          <RiStarFill className="size-4 text-primary" />
                        ) : (
                          <RiStarLine className="size-4" />
                        )}
                      </button>
                    ) : null}
                    <Link
                      href={`/ai/models/${model.id}`}
                      aria-label={`查看 ${model.name} 详情`}
                      className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      详情
                      <RiArrowRightLine className="size-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
