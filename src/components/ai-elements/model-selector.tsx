"use client"

import * as React from "react"
import Link from "next/link"
import {
  RiArrowRightUpLine,
  RiBrain4Line,
  RiKey2Line,
  RiLockLine,
} from "react-icons/ri"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import type { PlaygroundModel } from "@/lib/ai-gateway/shared"
import type { ApiConnection } from "@/lib/compute/connections"
import { ProviderLogo } from "@/components/compute/ProviderLogo"
import { formatPricePerMillion, formatTokens } from "@/lib/compute/service"

export const FREE_PREFIX = "free:"
export const CONN_PREFIX = "conn:"

export function isConnKey(key: string): boolean {
  return key.startsWith(CONN_PREFIX)
}

export function connModelOf(key: string, connectionId: string): string {
  return key.replace(`${CONN_PREFIX}${connectionId}:`, "")
}

/** 行内只标「免费」；零数据保留 / 不训练是共性信息，集中在组标签说一次，不逐行重复 */
function FreeChip() {
  return (
    <span className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-primary">
      免费
    </span>
  )
}

/** 悬浮时展示的完整信息（原生 title，支持多行） */
function modelTooltip(model: PlaygroundModel): string {
  const price =
    model.inputPricePerMillionUsd === 0 && model.outputPricePerMillionUsd === 0
      ? "免费（Coolha 赞助）"
      : `输入 ${formatPricePerMillion(model.inputPricePerMillionUsd)} · 输出 ${formatPricePerMillion(model.outputPricePerMillionUsd)}`
  return [
    `${model.name} · ${model.providerName}`,
    model.modelId,
    `${price} · 上下文 ${model.contextLength > 0 ? formatTokens(model.contextLength) : "未公布"}`,
    "",
    "免费：推理费用由 Coolha 赞助，无需你自己的 Key",
    `零数据保留：供应商不保留你的对话数据（${model.zeroDataRetention === "all" ? "是" : "否"}）`,
    `不用于训练：供应商不用你的数据训练模型（${model.noTraining === "all" ? "是" : "否"}）`,
    "",
    "需签名登录；每日额度全体登录用户统一，订阅不会增加。",
  ].join("\n")
}

/**
 * Model Selector（基于 Dropdown Menu）。
 *
 * 信息设计原则：**交互优先，解释不占界面**。
 *   - 行内只有一个「免费」徽章；零数据保留 / 不训练这类共性信息在组标签说一次，不逐行刷屏；
 *   - 完整规格与数据政策放悬浮（title），不做常驻文字块；
 *   - 「查看详情」入口只在悬浮时出现，不占常驻位；
 *   - 单滚动容器：由 DropdownMenuContent 统一滚动，底部操作用 sticky 固定，不再嵌套第二层滚动。
 */
export function ModelSelector({
  freeModels,
  connections,
  modelKey,
  onChange,
  disabled,
  size = "sm",
  signedIn = false,
}: {
  freeModels: PlaygroundModel[]
  connections: ApiConnection[]
  modelKey: string
  onChange: (key: string) => void
  disabled?: boolean
  size?: "sm" | "icon-sm"
  /** 是否已签名登录——决定赞助模型组的提示 */
  signedIn?: boolean
}) {
  const enabled = connections.filter((item) => item.enabled)
  const connSelected = isConnKey(modelKey)
  const selectedFree = connSelected
    ? undefined
    : freeModels.find((model) => model.id === modelKey.replace(FREE_PREFIX, ""))
  const selectedConn = connSelected
    ? connections.find((item) => modelKey.startsWith(`${CONN_PREFIX}${item.id}:`))
    : undefined
  const currentLabel = selectedFree
    ? selectedFree.name
    : selectedConn
      ? `${selectedConn.name}${
          connModelOf(modelKey, selectedConn.id)
            ? ` · ${connModelOf(modelKey, selectedConn.id)}`
            : ""
        }`
      : "选择模型"

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
        {selectedFree ? (
          <ProviderLogo
            providerId={selectedFree.providerId}
            providerName={selectedFree.providerName}
            size={16}
          />
        ) : (
          <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary/15 text-[8px] font-semibold text-primary">
            MY
          </span>
        )}
        {size === "sm" ? <span className="truncate">{currentLabel}</span> : null}
        {selectedFree ? <FreeChip /> : null}
        <svg viewBox="0 0 24 24" className="ml-auto size-3.5 shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-80 p-0">
        <DropdownMenuRadioGroup value={modelKey} onValueChange={onChange}>
          {freeModels.length > 0 ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-wrap items-center gap-1.5">
                <span>赞助模型</span>
                <span className="font-normal text-muted-foreground">免费 · 零数据保留 · 不用于训练</span>
                {signedIn ? null : (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-normal text-amber-600 dark:text-amber-400">
                    <RiLockLine className="size-3" />
                    需登录
                  </span>
                )}
              </DropdownMenuLabel>
              {freeModels.map((model) => (
                <DropdownMenuRadioItem
                  key={model.id}
                  value={`${FREE_PREFIX}${model.id}`}
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
                  <FreeChip />
                  {/* 悬浮才出现的详情入口：点它只跳转，不切换模型 */}
                  <Link
                    href={`/ai/models/${model.id}`}
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
          ) : null}

          {enabled.length > 0 ? (
            <>
              {freeModels.length > 0 ? <DropdownMenuSeparator /> : null}
              <DropdownMenuGroup>
                <DropdownMenuLabel className="flex flex-wrap items-center gap-1.5">
                  <span>我的连接</span>
                  <span className="font-normal text-muted-foreground">你自己的 Key · 无需登录 · 不限量</span>
                </DropdownMenuLabel>
                {enabled.flatMap((connection) =>
                  (connection.models.length > 0 ? connection.models : [""]).map((model) => (
                    <DropdownMenuRadioItem
                      key={`${connection.id}:${model}`}
                      value={`${CONN_PREFIX}${connection.id}:${model}`}
                      closeOnClick
                      title={`${connection.name}${model ? ` · ${model}` : ""}\n用你自己的 API Key 直连，无需登录、不限量\n费用由你承担，Coolha 不经手密钥`}
                    >
                      <span className="inline-flex size-4 items-center justify-center rounded-full bg-primary/15 text-[8px] font-semibold text-primary">
                        MY
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {connection.name}
                        {model ? (
                          <span className="ml-1 font-mono text-xs text-muted-foreground">{model}</span>
                        ) : null}
                      </span>
                    </DropdownMenuRadioItem>
                  )),
                )}
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuRadioGroup>

        {freeModels.length === 0 && enabled.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            暂无可直连的模型，先添加一个连接
          </p>
        ) : null}

        {/* 底部操作：sticky 固定，随单滚动容器贴底 */}
        <div className="sticky bottom-0 border-t bg-popover p-1">
          <DropdownMenuItem
            render={
              <Link href="/ai/api-keys">
                <RiKey2Line className="size-4" />
                配置自定义模型
              </Link>
            }
          />
          <DropdownMenuItem
            render={
              <Link href="/ai/models">
                <RiBrain4Line className="size-4" />
                从模型广场添加
              </Link>
            }
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
