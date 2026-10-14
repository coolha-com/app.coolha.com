"use client"

import { useCallback, useMemo, useSyncExternalStore, useState } from "react"
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiLayoutGridLine,
  RiListUnordered,
  RiMoneyDollarCircleLine,
} from "react-icons/ri"
import type {
  ComputeCapability,
  ComputeModel,
  ComputeModelType,
  ComputeProvider,
  ModelSort,
} from "@/lib/compute/types"
import {
  CAPABILITY_LABELS,
  MODEL_TYPE_LABELS,
  SORT_LABELS,
  filterModels,
} from "@/lib/compute/service"
import { FilterSelect, type FilterOption } from "./FilterSelect"
import { ModelCard } from "./ModelCard"
import { ModelsTable } from "./ModelsTable"
import { ProviderLogo } from "./ProviderLogo"
import {
  CAPABILITY_FILTER_ICONS,
  MODEL_TYPE_ICONS,
} from "./capability-meta"
import { cn } from "@/lib/utils"

const FAVORITES_STORAGE_KEY = "coolha.compute.favorites.v1"

/** 首屏渲染条数：真实目录有数百个模型，分页追加渲染以控制首屏体积 */
const PAGE_SIZE = 60

let cachedFavorites: string[] | null = null
const favoriteListeners = new Set<() => void>()

function readFavorites(): string[] {
  if (typeof window === "undefined") return []
  if (!cachedFavorites) {
    try {
      const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : []
      cachedFavorites = Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : []
    } catch {
      cachedFavorites = []
    }
  }
  return cachedFavorites
}

function subscribeFavorites(listener: () => void) {
  favoriteListeners.add(listener)
  return () => {
    favoriteListeners.delete(listener)
  }
}

function toggleFavoriteInStore(id: string) {
  const current = readFavorites()
  const next = current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id]
  cachedFavorites = next
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // 持久化失败时仅更新内存态
  }
  favoriteListeners.forEach((listener) => listener())
}

function sortDirectionIcon(sort: ModelSort) {
  if (sort.endsWith("-asc")) return <RiArrowUpLine className="size-3.5 text-muted-foreground" />
  return <RiArrowDownLine className="size-3.5 text-muted-foreground" />
}

const PRICE_THRESHOLDS: Array<{ label: string; value: number | null }> = [
  { label: "全部价格", value: null },
  { label: "≤ $0.10/M", value: 0.1 },
  { label: "≤ $0.50/M", value: 0.5 },
  { label: "≤ $1.00/M", value: 1 },
  { label: "≤ $5.00/M", value: 5 },
]

interface FilterState {
  search: string
  type: ComputeModelType | "all"
  providerId: string
  capability: ComputeCapability | "all"
  maxPrice: number | null
  sort: ModelSort
  hideDeprecated: boolean
}

const DEFAULT_FILTERS: FilterState = {
  search: "",
  type: "all",
  providerId: "all",
  capability: "all",
  maxPrice: null,
  sort: "name-asc",
  hideDeprecated: true,
}

/**
 * 模型广场浏览器：客户端筛选/排序/搜索/收藏（localStorage）。
 * 模型与供应商列表由服务端传入（真实目录或演示目录），筛选逻辑与数据来源解耦。
 */
export function ModelsBrowser({
  models,
  providers,
}: {
  models: ComputeModel[]
  providers: ComputeProvider[]
}) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [view, setView] = useState<"table" | "grid">("table")
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const favorites = useSyncExternalStore(subscribeFavorites, readFavorites, () => [])
  const toggleFavorite = useCallback((id: string) => toggleFavoriteInStore(id), [])

  /** 任一筛选条件变化即回到首屏分页，避免 effect 内 setState */
  const updateFilters = useCallback((patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }))
    setVisibleCount(PAGE_SIZE)
  }, [])

  const { search, type, providerId, capability, maxPrice, sort, hideDeprecated } = filters

  const typeOptions = useMemo<FilterOption[]>(
    () => [
      { value: "all", label: "全部类型" },
      ...(Object.keys(MODEL_TYPE_LABELS) as ComputeModelType[]).map((value) => {
        const Icon = MODEL_TYPE_ICONS[value]
        return {
          value,
          label: MODEL_TYPE_LABELS[value],
          icon: <Icon className="size-3.5 text-muted-foreground" aria-hidden />,
        }
      }),
    ],
    [],
  )

  const providerOptions = useMemo<FilterOption[]>(
    () => [
      { value: "all", label: "全部供应商" },
      ...providers.map((provider) => ({
        value: provider.id,
        label: provider.name,
        icon: (
          <ProviderLogo
            providerId={provider.id}
            providerName={provider.name}
            size={16}
          />
        ),
      })),
    ],
    [providers],
  )

  const capabilityOptions = useMemo<FilterOption[]>(
    () => [
      { value: "all", label: "全部能力" },
      ...(Object.keys(CAPABILITY_LABELS) as ComputeCapability[]).map((value) => {
        const Icon = CAPABILITY_FILTER_ICONS[value]
        return {
          value,
          label: CAPABILITY_LABELS[value],
          icon: <Icon className="size-3.5 text-muted-foreground" aria-hidden />,
        }
      }),
    ],
    [],
  )

  const priceOptions = useMemo<FilterOption[]>(
    () =>
      PRICE_THRESHOLDS.map((threshold) => ({
        value: threshold.value === null ? "all" : String(threshold.value),
        label: threshold.label,
        icon: (
          <RiMoneyDollarCircleLine className="size-3.5 text-muted-foreground" aria-hidden />
        ),
      })),
    [],
  )

  const sortOptions = useMemo<FilterOption[]>(
    () =>
      (Object.keys(SORT_LABELS) as ModelSort[]).map((value) => ({
        value,
        label: SORT_LABELS[value],
        icon: sortDirectionIcon(value),
      })),
    [],
  )

  const visibleModels = useMemo(() => {
    const filtered = filterModels(models, {
      search,
      type,
      providerId,
      capability,
      maxInputPricePerMillion: maxPrice,
      sort,
    })
    return hideDeprecated ? filtered.filter((model) => model.status !== "maintenance") : filtered
  }, [models, search, type, providerId, capability, maxPrice, sort, hideDeprecated])

  const shownModels = useMemo(
    () => visibleModels.slice(0, visibleCount),
    [visibleModels, visibleCount],
  )

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS)
    setVisibleCount(PAGE_SIZE)
  }

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="search"
            value={search}
            onChange={(event) => updateFilters({ search: event.target.value })}
            placeholder="搜索模型名称、ID 或供应商"
            aria-label="搜索模型"
            className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:max-w-72"
          />
          <div className="flex flex-wrap gap-2">
            <FilterSelect
              label="模型类型"
              value={type}
              onChange={(value) => updateFilters({ type: value as ComputeModelType | "all" })}
              options={typeOptions}
            />
            <FilterSelect
              label="供应商"
              value={providerId}
              onChange={(value) => updateFilters({ providerId: value })}
              options={providerOptions}
              popupClassName="max-h-80"
            />
            <FilterSelect
              label="能力"
              value={capability}
              onChange={(value) => updateFilters({ capability: value as ComputeCapability | "all" })}
              options={capabilityOptions}
            />
            <FilterSelect
              label="输入价格上限"
              value={maxPrice === null ? "all" : String(maxPrice)}
              onChange={(value) =>
                updateFilters({ maxPrice: value === "all" ? null : Number(value) })
              }
              options={priceOptions}
            />
            <FilterSelect
              label="排序方式"
              value={sort}
              onChange={(value) => updateFilters({ sort: value as ModelSort })}
              options={sortOptions}
              triggerClassName="min-w-44"
            />
            <button
              type="button"
              onClick={resetFilters}
              className="h-9 rounded-lg border bg-background px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              重置
            </button>
            <div
              role="group"
              aria-label="展示方式"
              className="inline-flex h-9 items-center rounded-lg border bg-background p-0.5"
            >
              <button
                type="button"
                onClick={() => setView("table")}
                aria-pressed={view === "table"}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                  view === "table"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <RiListUnordered className="size-3.5" />
                列表
              </button>
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-pressed={view === "grid"}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                  view === "grid"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <RiLayoutGridLine className="size-3.5" />
                卡片
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={hideDeprecated}
              onChange={(event) => updateFilters({ hideDeprecated: event.target.checked })}
              className="size-3.5 accent-[var(--primary)]"
            />
            隐藏已下线模型
          </label>
          <p className="text-xs text-muted-foreground">
            共 {visibleModels.length} 个模型 · 已显示 {shownModels.length} 个
            {favorites.length > 0 ? ` · 已收藏 ${favorites.length} 个（收藏保存在本地浏览器）` : ""}
            {view === "table" ? " · 点击「上下文 / 输入 / 输出」表头切换排序" : ""}
          </p>
        </div>
      </div>

      {visibleModels.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          没有符合当前筛选条件的模型，请调整筛选或重置。
        </div>
      ) : (
        <>
          {view === "table" ? (
            <ModelsTable
              models={shownModels}
              sort={sort}
              onSortChange={(next) => updateFilters({ sort: next })}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
            />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shownModels.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  isFavorite={favorites.includes(model.id)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          )}

          {shownModels.length < visibleModels.length ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                className="h-10 rounded-xl border bg-card px-5 text-sm font-medium transition-colors hover:border-primary/60 hover:text-primary"
              >
                加载更多（剩余 {visibleModels.length - shownModels.length} 个）
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
