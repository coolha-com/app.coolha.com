"use client"

import { useState } from "react"
import { RiCheckboxCircleLine, RiRefreshLine, RiShieldKeyholeLine } from "react-icons/ri"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { constraintsAccepted, type TaskConstraints } from "@/lib/agents/agent-contracts"
import type { AgentOption } from "@/components/agents/AgentSelector"

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

/** 服务状态（来自 GET /api/agents/credits）。不含价格，也不含购买入口。 */
export interface CreditsState {
  accessMode: "local_open" | "preview_open" | "closed"
  openAccess: boolean
  hasGrant: boolean
  remainingUsd: number
  validDaysLeft: number | null
  budgetUsd: number
  openRequests: number
  openRequestCap: number
  openSpendUsd: number | null
  serviceAvailable: boolean
  gatewayName: string
  defaultModel: string
}

/**
 * 智能体配置面板：选中需要配置的智能体后，在对话主区出现（替代聊天框）。
 * 用户勾选约束、点「开始任务」后才真正进入对话。模型在顶部工具栏选择，这里只负责
 * 智能体专属的约束配置——目前仅 RWA 有强制约束。
 *
 * 开发/预览开放模式下可以直接开始；生产未授权时说明服务未开放，不提供付款。
 */
export function AgentConfigPanel({
  agent,
  modelLabel,
  signedIn,
  busy,
  requiresConstraints = true,
  credits,
  onRefreshCredits,
  paywallError,
  onStart,
}: {
  agent: AgentOption
  modelLabel: string
  signedIn: boolean
  busy?: boolean
  /** 只有像 RWA 这类强制约束的智能体才展示约束勾选项 */
  requiresConstraints?: boolean
  /** 服务状态；null = 还没读到 */
  credits?: CreditsState | null
  onRefreshCredits?: () => void
  /** 闸门拦下时的说明 */
  paywallError?: string | null
  onStart: (value: AgentConfigValue) => void
}) {
  const [constraints, setConstraints] = useState<TaskConstraints>({
    readOnly: true,
    citeSources: true,
    unverifiedNotFact: true,
  })

  const accepted = requiresConstraints ? constraintsAccepted(constraints) : true
  const allowed = !credits || credits.openAccess || credits.hasGrant
  const canStart = signedIn && accepted && !busy && allowed
  const modeLabel =
    credits?.accessMode === "local_open"
      ? "本地开发测试"
      : credits?.accessMode === "preview_open"
        ? "预览开发测试"
        : "未开放"

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
          <h3 className="text-sm font-medium">服务状态</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">访问模式</dt>
              <dd>{credits ? modeLabel : signedIn ? "读取中" : "请先登入"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">当前模型</dt>
              <dd className="truncate">{modelLabel || credits?.defaultModel || "平台默认模型"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">网关</dt>
              <dd>{credits?.gatewayName || (signedIn ? "读取中" : "登入后显示")}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">服务可用</dt>
              <dd>{credits ? (credits.serviceAvailable ? "可用" : "不可用") : signedIn ? "读取中" : "请先登入"}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            在上方工具栏的「模型」里切换。可选模型与服务端白名单一致。
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

        {signedIn && credits?.openAccess ? (
          <section className="rounded-3xl border bg-card p-4">
            <p className="text-sm font-medium">开发测试模式</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              当前环境不需要购买即可测试 Agent。调用仍会记录模型和 token；
              拿得到上游单价时记录成本，拿不到就不记金额。
              24 小时内已知成本达到 ${credits.budgetUsd.toFixed(0)}，或请求达到{" "}
              {credits.openRequestCap} 次后会暂停。
              {credits.openSpendUsd !== null
                ? ` 已记录成本 $${credits.openSpendUsd.toFixed(6)}。`
                : " 已记录成本：未提供。"}
              {` 已记录请求 ${credits.openRequests} 次。`}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={onRefreshCredits}
              disabled={busy}
            >
              <RiRefreshLine className="size-4" />
              刷新用量
            </Button>
          </section>
        ) : null}

        {signedIn && credits && !credits.openAccess && !credits.hasGrant ? (
          <section className="rounded-3xl border bg-card p-4">
            <p className="text-sm font-medium">执行未开放</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              生产环境在正式商业化之前不开放未经授权的 Agent 执行。当前没有收款入口，也不会生成订单。
            </p>
          </section>
        ) : null}

        {signedIn && credits?.hasGrant && !credits.openAccess ? (
          <section className="rounded-3xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                成本护栏剩余 ${credits.remainingUsd.toFixed(2)} / ${credits.budgetUsd.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground">
                {credits.validDaysLeft !== null ? `${credits.validDaysLeft} 天后到期` : "已到期"}
              </p>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              这是已有授权的成本上限，不是新的付款状态。
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
        {signedIn && credits && !allowed ? (
          <p className="text-center text-xs text-muted-foreground">
            当前环境不能开始未授权的任务。
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
