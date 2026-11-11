"use client"

import Link from "next/link"
import { RiArrowRightUpLine, RiCpuLine } from "react-icons/ri"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import type { PlaygroundModel } from "@/lib/ai-gateway/shared"
import { ProviderLogo } from "@/components/compute/ProviderLogo"
import { formatPricePerMillion, formatTokens } from "@/lib/compute/service"

/**
 * 悬浮时展示的完整规格（原生 title，支持多行）。
 * 统一推理网关只登记模型 ID，不提供价格 / 数据政策元数据：
 * 缺失项一律显示「未提供」，不把 0 或 null 说成「免费 / 否」。
 */
function modelTooltip(model: PlaygroundModel): string {
  const hasPricing = model.dataSource !== "mock" && (
    model.inputPricePerMillionUsd > 0 || model.outputPricePerMillionUsd > 0
  )
  return [
    `${model.name} · ${model.providerName}`,
    model.modelId,
    hasPricing
      ? `输入 ${formatPricePerMillion(model.inputPricePerMillionUsd)} · 输出 ${formatPricePerMillion(model.outputPricePerMillionUsd)}`
      : "价格：未提供（以所接网关账单为准）",
    `上下文 ${model.contextLength > 0 ? formatTokens(model.contextLength) : "未提供"}`,
    "",
    `零数据保留：${model.zeroDataRetention ? (model.zeroDataRetention === "all" ? "是" : "否") : "未提供"}`,
    `不用于训练：${model.noTraining ? (model.noTraining === "all" ? "是" : "否") : "未提供"}`,
  ].join("\n")
}

/**
 * 平台模型切换器：沿用原来的 Dropdown Menu + outline 按钮样式。
 *
 * 只列统一推理网关 INFERENCE_MODELS 里登记的平台模型；自带 Key 通道已下线，
 * 因此不再有「我的连接」分组、免费徽章、额度/订阅说明，也不再链接到 API 连接页。
 * Vercel AI Gateway 已永久停用，模型目录不再回源其上游。
 */
export function ModelSelector({
  models,
  modelId,
  onChange,
  disabled,
  size = "sm",
}: {
  models: PlaygroundModel[]
  modelId: string
  onChange: (id: string) => void
  disabled?: boolean
  size?: "sm" | "icon-sm"
}) {
  const selected = models.find((model) => model.modelId === modelId) ?? null
  const currentLabel = selected?.name ?? (modelId || "选择模型")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size={size === "icon-sm" ? "icon-sm" : "sm"}
            disabled={disabled}
            aria-label={`模型：${currentLabel}`}
            className="min-w-0 max-w-[16rem] justify-start gap-1.5"
          />
        }
      >
        {selected ? (
          <ProviderLogo
            providerId={selected.providerId}
            providerName={selected.providerName}
            size={16}
          />
        ) : (
          <RiCpuLine className="size-4" />
        )}
        {size === "sm" ? <span className="truncate">{currentLabel}</span> : null}
        <svg viewBox="0 0 24 24" className="ml-auto size-3.5 shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="w-80 p-2">
        <DropdownMenuRadioGroup value={modelId} onValueChange={onChange}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-wrap items-center gap-1.5">
              <span>平台模型</span>
            </DropdownMenuLabel>
            {models.map((model) => (
              <DropdownMenuRadioItem
                key={model.modelId}
                value={model.modelId}
                closeOnClick
                className="group gap-2 pr-12"
                title={modelTooltip(model)}
              >
                <ProviderLogo
                  providerId={model.providerId}
                  providerName={model.providerName}
                  size={16}
                />
                <span className="min-w-0 flex-1 truncate">{model.name}</span>
                <Link
                  href={`/agents/models/${model.id}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`查看 ${model.name} 详情`}
                  title="查看模型详情"
                  className="absolute right-7 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 group-data-[highlighted]:opacity-100"
                >
                  <RiArrowRightUpLine className="size-3.5" />
                </Link>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuRadioGroup>

        {models.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            模型目录暂不可用，将使用平台默认模型
          </p>
        ) : null}

        <div className="sticky bottom-0 border-t bg-popover p-1">
          <DropdownMenuItem
            render={
              <Link href="/agents/models">
                <RiCpuLine className="size-4" />
                查看模型目录
              </Link>
            }
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
