"use client"

import * as React from "react"
import Link from "next/link"
import { RiBrain4Line, RiKey2Line } from "react-icons/ri"

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
import { isFreeModel, type PlaygroundModel } from "@/lib/ai-gateway/shared"
import type { ApiConnection } from "@/lib/compute/connections"
import { ProviderLogo } from "@/components/compute/ProviderLogo"

export const FREE_PREFIX = "free:"
export const CONN_PREFIX = "conn:"

export function isConnKey(key: string): boolean {
  return key.startsWith(CONN_PREFIX)
}

export function connModelOf(key: string, connectionId: string): string {
  return key.replace(`${CONN_PREFIX}${connectionId}:`, "")
}

/**
 * AI Elements「Model Selector」模式（shadcn 版）：基于 Dropdown Menu 构建。
 * 与官方模式的差异：模型区可滚动，底部三个操作项固定不随滚动移动。
 */
export function ModelSelector({
  freeModels,
  connections,
  modelKey,
  onChange,
  disabled,
  size = "sm",
}: {
  freeModels: PlaygroundModel[]
  connections: ApiConnection[]
  modelKey: string
  onChange: (key: string) => void
  disabled?: boolean
  size?: "sm" | "icon-sm"
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
            className="min-w-0 max-w-[15rem] justify-start gap-1.5"
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
        <svg viewBox="0 0 24 24" className="ml-auto size-3.5 shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72 p-0">
        {/* 可滚动模型区 */}
        <div className="max-h-72 overflow-y-auto overscroll-contain p-1">
          <DropdownMenuRadioGroup value={modelKey} onValueChange={(value) => onChange(value)}>
            {freeModels.length > 0 ? (
              <DropdownMenuGroup>
                <DropdownMenuLabel>免费模型</DropdownMenuLabel>
                {freeModels.map((model) => (
                  <DropdownMenuRadioItem key={model.id} value={`${FREE_PREFIX}${model.id}`} closeOnClick>
                    <ProviderLogo
                      providerId={model.providerId}
                      providerName={model.providerName}
                      size={16}
                    />
                    <span className="min-w-0 flex-1 truncate">{model.name}</span>
                    {isFreeModel(model) ? (
                      <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                        免费
                      </span>
                    ) : null}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuGroup>
            ) : null}

            {enabled.length > 0 ? (
              <DropdownMenuGroup>
                <DropdownMenuLabel>我的连接</DropdownMenuLabel>
                {enabled.flatMap((connection) =>
                  (connection.models.length > 0 ? connection.models : [""]).map((model) => (
                    <DropdownMenuRadioItem
                      key={`${connection.id}:${model}`}
                      value={`${CONN_PREFIX}${connection.id}:${model}`}
                      closeOnClick
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
            ) : null}
          </DropdownMenuRadioGroup>

          {freeModels.length === 0 && enabled.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              还没有可用模型，先添加一个连接
            </p>
          ) : null}
        </div>

        {/* 固定操作区：真实链接，点击即跳转 */}
        <div className="border-t bg-muted/20 p-1">
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
