import Link from "next/link"
import { RiArrowRightLine, RiStarFill, RiStarLine } from "react-icons/ri"
import type { ComputeModel } from "@/lib/compute/types"
import {
  MODEL_TYPE_LABELS,
  formatLatency,
  formatPricePerMillion,
  formatTokens,
} from "@/lib/compute/service"
import { DataSourceBadge } from "./MockBadge"
import { CapabilityBadges } from "./CapabilityBadges"
import { ProviderLogo } from "./ProviderLogo"
import { modelCapabilityTags } from "./capability-meta"
import { StatusBadge } from "./StatusBadge"
import { cn } from "@/lib/utils"

/** 模型卡片：模型广场网格单元 */
export function ModelCard({
  model,
  isFavorite = false,
  onToggleFavorite,
}: {
  model: ComputeModel
  isFavorite?: boolean
  onToggleFavorite?: (id: string) => void
}) {
  return (
    <article className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm transition hover:border-primary/60">
      <div className="flex items-start justify-between gap-3">
        <ProviderLogo
          providerId={model.providerId}
          providerName={model.providerName}
          size={40}
          className="rounded-xl"
        />
        <div className="flex items-center gap-2">
          <StatusBadge status={model.status} />
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
        </div>
      </div>

      <h3 className="mt-4 font-semibold">
        <Link href={`/ai/models/${model.id}`} className="hover:text-primary">
          {model.name}
        </Link>
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {model.providerName} · {MODEL_TYPE_LABELS[model.type]} · <code className="font-mono">{model.modelId}</code>
      </p>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{model.summary}</p>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">输入价格</dt>
          <dd className="mt-0.5 font-medium">{formatPricePerMillion(model.inputPricePerMillionUsd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">输出价格</dt>
          <dd className="mt-0.5 font-medium">{formatPricePerMillion(model.outputPricePerMillionUsd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">上下文</dt>
          <dd className="mt-0.5 font-medium">{formatTokens(model.contextLength)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">延迟</dt>
          <dd className="mt-0.5 font-medium">{formatLatency(model.latencyMs)}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <CapabilityBadges tags={modelCapabilityTags(model)} max={4} />
      </div>

      <div className="mt-4 flex items-center justify-between border-t pt-4">
        <DataSourceBadge source={model.dataSource} />
        <Link
          href={`/ai/models/${model.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          详情
          <RiArrowRightLine className="size-4" />
        </Link>
      </div>
    </article>
  )
}

/** 收藏星星（独立小组件，便于复用） */
export function FavoriteButton({
  isFavorite,
  onToggle,
  modelName,
  className,
}: {
  isFavorite: boolean
  onToggle: () => void
  modelName: string
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={isFavorite ? `取消收藏 ${modelName}` : `收藏 ${modelName}`}
      aria-pressed={isFavorite}
      onClick={onToggle}
      className={cn("rounded-full p-1.5 text-muted-foreground transition-colors hover:text-primary", className)}
    >
      {isFavorite ? <RiStarFill className="size-4 text-primary" /> : <RiStarLine className="size-4" />}
    </button>
  )
}
