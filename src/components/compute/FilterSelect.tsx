"use client"

import type { ReactNode } from "react"
import { Select } from "@base-ui/react/select"
import { RiArrowDownSLine, RiCheckLine } from "react-icons/ri"
import { cn } from "@/lib/utils"

export interface FilterOption {
  value: string
  label: string
  /** 选项前缀：供应商 Logo 或类型/能力图标 */
  icon?: ReactNode
  /** 选项右侧补充说明，如“≤ $0.10/M” */
  hint?: string
}

/**
 * 筛选下拉：基于 Base UI Select，选项可带 Logo / 图标。
 * 原生 <select> 的 <option> 只能放纯文本，无法渲染 Logo，故自定义。
 */
export function FilterSelect({
  label,
  value,
  onChange,
  options,
  triggerClassName,
  popupClassName,
  placeholder = "全部",
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: FilterOption[]
  triggerClassName?: string
  popupClassName?: string
  placeholder?: string
}) {
  const selected = options.find((option) => option.value === value)

  return (
    <Select.Root
      value={value}
      onValueChange={(next) => {
        if (next) onChange(String(next))
      }}
      items={options.map((option) => ({ value: option.value, label: option.label }))}
    >
      <Select.Trigger
        aria-label={label}
        className={cn(
          "inline-flex h-9 max-w-64 items-center gap-1.5 rounded-lg border bg-background px-3 text-sm text-foreground outline-none transition-colors hover:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[popup-open]:border-primary/60",
          triggerClassName,
        )}
      >
        {selected?.icon ? <span className="shrink-0">{selected.icon}</span> : null}
        <Select.Value className="truncate">{() => selected?.label ?? placeholder}</Select.Value>
        <Select.Icon className="ml-auto shrink-0 text-muted-foreground">
          <RiArrowDownSLine className="size-4" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Positioner sideOffset={6} align="start" className="z-50">
          <Select.Popup
            className={cn(
              "max-h-80 min-w-56 overflow-y-auto overscroll-contain rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
              popupClassName,
            )}
          >
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted"
              >
                <Select.ItemIndicator className="mr-0.5 flex w-3 shrink-0 justify-center text-primary">
                  <RiCheckLine className="size-3.5" />
                </Select.ItemIndicator>
                {option.icon ? <span className="shrink-0">{option.icon}</span> : null}
                <Select.ItemText className="truncate">{option.label}</Select.ItemText>
                {option.hint ? (
                  <span className="ml-auto shrink-0 pl-2 text-xs tabular-nums text-muted-foreground">
                    {option.hint}
                  </span>
                ) : null}
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
