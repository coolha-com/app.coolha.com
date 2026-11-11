"use client"

import Link from "next/link"
import { RiArrowRightUpLine, RiRobot2Line } from "react-icons/ri"

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export interface AgentOption {
  id: string
  name: string
  subtitle: string
  live: boolean
}

/**
 * 智能服务切换器：胶囊触发器 + 图标 / 副标题 / 在线徽章的单选面板。
 *
 * 这是根路由 / 上唯一的 agent 入口——侧边栏的 agents 导航已被移除，
 * 用户改从本下拉进入，末项带「全部智能服务 →」跳 /agents。
 * 未上线 agent 仅展示、不可选（与旧的 native select 行为一致）。
 */
export function AgentSelector({
  agents,
  value,
  onChange,
  disabled,
}: {
  agents: readonly AgentOption[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  const selected = agents.find((agent) => agent.id === value) ?? agents[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-label={`智能服务：${selected?.name ?? "选择"}`}
            className="min-w-0 max-w-[14rem] justify-start gap-2"
          />
        }
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <RiRobot2Line className="size-3.5" />
        </span>
        <span className="truncate">{selected?.name ?? "选择智能服务"}</span>
        <svg
          viewBox="0 0 24 24"
          className="ml-auto size-3.5 shrink-0 opacity-60"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={6} className="w-72 p-2">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-1.5">
              <span>智能服务</span>
            </DropdownMenuLabel>
            {agents.map((agent) => (
              <DropdownMenuRadioItem
                key={agent.id}
                value={agent.id}
                closeOnClick
                disabled={!agent.live}
                className="group gap-3 pr-12"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <RiRobot2Line className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                    {agent.name}
                    {agent.live ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-normal text-emerald-600 dark:text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        在线
                      </span>
                    ) : (
                      <span className="text-[10px] font-normal text-muted-foreground">
                        未上线
                      </span>
                    )}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {agent.subtitle}
                  </span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            <Link href="/agents">
              <RiArrowRightUpLine className="size-4" />
              全部智能服务
            </Link>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
