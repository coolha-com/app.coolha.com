"use client"

import { useState } from "react"
import { RiCheckboxCircleLine, RiRefreshLine, RiShieldKeyholeLine } from "react-icons/ri"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { constraintsAccepted, type TaskConstraints } from "@/lib/agents/agent-contracts"
import type { AgentOption } from "@/components/agents/AgentSelector"
import { OneTimePurchase } from "@/components/agents/OneTimePurchase"

const CONSTRAINTS: { key: keyof TaskConstraints; label: string; detail: string }[] = [
  { key: "readOnly", label: "只读", detail: "不签名、不转账、不兑换" },
  { key: "citeSources", label: "必须标注来源", detail: "事实带数据来源和抓取时间" },
  { key: "unverifiedNotFact", label: "不得把未验证信息当事实", detail: "没取到的维度保持未接入，不补数值" },
]

const AGENT_BLURB: Record<string, string> = {
  "coolha-rwa":
    "RWA 尽调 Agent：给它一个合约 / 代币 / 项目，它会带着下面的约束做尽职调查。整段对话就是这次任务的成果，结束后会存入「历史任务」，随时可回看续聊。",
}

export interface AgentConfigValue {
  constraints: TaskConstraints
}

/** 付费状态（来自 GET /api/agents/credits） */
export interface CreditsState {
  hasGrant: boolean
  remainingUsd: number
  validDaysLeft: number | null
  budgetUsd: number
  priceUsd: number
  validityDays: number
  testMode: boolean
}

/**
 * 智能体配置面板：选中需要配置的智能体后，在对话主区出现（替代聊天框）。
 * 用户勾选约束、点「开始任务」后才真正进入对话。模型在顶部工具栏选择，这里只负责
 * 智能体专属的约束配置——目前仅 RWA 有强制约束。
 *
 * 付费闸门：没有可用授权时，这里就是收银台（先买后用）；有授权则显示剩余额度。
 */
export function AgentConfigPanel({
  agent,
  modelLabel,
  signedIn,
  busy,
  requiresConstraints = true,
  credits,
  onRefreshCredits,
  onTestGrant,
  paywallError,
  onStart,
}: {
  agent: AgentOption
  modelLabel: string
  signedIn: boolean
  busy?: boolean
  /** 只有像 RWA 这类强制约束的智能体才展示约束勾选项 */
  requiresConstraints?: boolean
  /** 付费状态；null = 还没读到 */
  credits?: CreditsState | null
  onRefreshCredits?: () => void
  /** 测试模式下直接发放一份授权（本地联调用） */
  onTestGrant?: () => void
  /** 付费闸门拦下时的说明 */
  paywallError?: string | null
  onStart: (value: AgentConfigValue) => void
}) {
  const [constraints, setConstraints] = useState<TaskConstraints>({
    readOnly: true,
    citeSources: true,
    unverifiedNotFact: true,
  })

  const accepted = requiresConstraints ? constraintsAccepted(constraints) : true
  const canStart = signedIn && accepted && !busy

  return (
    <div className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-8">
      <div className="w-full max-w-xl space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <RiShieldKeyholeLine className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-medium">{agent.name}</h2>
            <p className="text-xs text-muted-foreground">{agent.subtitle}</p>
          </div>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {AGENT_BLURB[agent.id] ?? "配置该智能体的任务约束后开始对话。"}
        </p>

        <section className="rounded-3xl border bg-card p-4">
          <h3 className="text-sm font-medium">使用模型</h3>
          <p className="mt-1 text-sm">{modelLabel || "平台默认模型"}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            在上方工具栏的「模型」里切换；切换后这里会同步。
          </p>
        </section>

        <section className="rounded-3xl border bg-card p-4">
          <h3 className="text-sm font-medium">任务约束</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            这项服务只在下面三条都打开时才能开始。
          </p>
          {requiresConstraints ? (
            <div className="mt-3 space-y-2">
              {CONSTRAINTS.map((item) => (
                <label key={item.key} className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={constraints[item.key]}
                    onChange={(event) =>
                      setConstraints((current) => ({
                        ...current,
                        [item.key]: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    <span className="font-medium">{item.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {item.detail}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              该智能体使用平台统一约束，无需额外配置，直接开始即可。
            </p>
          )}
        </section>

        {!signedIn ? (
          <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            请先登入，才能保存任务并存入历史。
          </p>
        ) : null}

        {paywallError ? (
          <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-xs leading-5">
            {paywallError}
          </p>
        ) : null}

        {/* 付费闸门：没有可用授权时，这里就是收银台（先买后用） */}
        {signedIn && credits && !credits.hasGrant ? (
          <section className="space-y-3">
            <div className="rounded-3xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">这项服务按次付费</p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                一次 ${credits.priceUsd.toFixed(2)} USD，含一份服务授权：有效期{" "}
                {credits.validityDays} 天，期间可用的 token 价值上限 ${credits.budgetUsd.toFixed(0)}。
                额度用满或到期后需要重新购买。
              </p>
            </div>
            <OneTimePurchase testMode={credits.testMode} returnTo="/" />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRefreshCredits}
                disabled={busy}
              >
                <RiRefreshLine className="size-4" />
                已完成支付？刷新额度
              </Button>
              {credits.testMode ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onTestGrant}
                  disabled={busy}
                >
                  测试模式：直接发一份授权
                </Button>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* 有授权：显示剩余额度 */}
        {signedIn && credits?.hasGrant ? (
          <section className="rounded-3xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                剩余额度 ${credits.remainingUsd.toFixed(2)} / ${credits.budgetUsd.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground">
                {credits.validDaysLeft !== null ? `${credits.validDaysLeft} 天后到期` : "已到期"}
              </p>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              额度按实际推理消耗的 token 价值扣减；用满后需要重新购买。
            </p>
          </section>
        ) : null}

        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={!canStart}
          onClick={() => onStart({ constraints })}
        >
          {busy ? "创建中…" : "开始任务"}
        </Button>
        {signedIn && !accepted ? (
          <p className="text-center text-xs text-muted-foreground">
            三条约束都打开后才能开始任务。
          </p>
        ) : null}
        {signedIn && credits && !credits.hasGrant ? (
          <p className="text-center text-xs text-muted-foreground">
            购买完成后才能开始任务。
          </p>
        ) : null}
      </div>
    </div>
  )
}

/** 小徽标：复用约束通过状态（给列表/续看页判断用，保持视觉一致）。 */
export function ConfigAcceptedBadge({ value }: { value: TaskConstraints | undefined }) {
  const ok = value ? constraintsAccepted(value) : false
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px]",
        ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
      )}
    >
      <RiCheckboxCircleLine className="size-3" />
      {ok ? "约束已确认" : "约束未确认"}
    </span>
  )
}
