"use client"

import { useState } from "react"
import {
  RiAlertLine,
  RiArrowRightLine,
  RiCheckboxCircleLine,
  RiExternalLinkLine,
  RiLoader4Line,
  RiPenNibLine,
  RiRefreshLine,
  RiSearchLine,
  RiShieldCheckLine,
} from "react-icons/ri"
import { cn } from "@/lib/utils"
import { RESEARCH_DIMENSIONS } from "@/lib/research/dimensions"
import { RISK_LABEL } from "@/lib/research/engine"
import type {
  DimensionFinding,
  DimensionId,
  ExecutionStep,
  ResearchReport,
  RiskLevel,
  SignalTone,
  TargetType,
} from "@/lib/research/types"

/* ----------------------------- 样式映射 ----------------------------- */

const RISK_STYLE: Record<RiskLevel, { text: string; bg: string; border: string }> = {
  low: { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  medium: { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
  high: { text: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/30" },
  critical: { text: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
}

/** 未接入维度的中性样式（不给任何风险色，避免暗示有结论） */
const UNAVAILABLE_STYLE = {
  text: "text-muted-foreground",
  bg: "bg-muted/40",
  border: "border-border",
}

const TONE_TEXT: Record<SignalTone, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
  neutral: "text-foreground",
}

const TARGET_TYPES: { id: TargetType; label: string; hint: string }[] = [
  { id: "contract", label: "智能合约", hint: "0x… 地址" },
  { id: "token", label: "代币", hint: "符号 / 地址" },
  { id: "project", label: "项目", hint: "名称 / 域名" },
]

/* ----------------------------- 主组件 ----------------------------- */

export function ResearchCockpit() {
  const [target, setTarget] = useState("")
  const [targetType, setTargetType] = useState<TargetType>("contract")
  const [selected, setSelected] = useState<DimensionId[]>(RESEARCH_DIMENSIONS.map((d) => d.id))
  const [report, setReport] = useState<ResearchReport | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showPlan, setShowPlan] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = target.trim()
  const canRun = trimmed.length >= 2 && selected.length > 0 && !running

  function toggleDimension(id: DimensionId) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function start() {
    if (!canRun) return
    setShowPlan(false)
    setRunning(true)
    setReport(null)
    setProgress(0)
    setError(null)

    const ids = selected.length > 0 ? selected : RESEARCH_DIMENSIONS.map((d) => d.id)
    // 逐维度推进的「挖掘」动画（真实请求在后台并发执行）
    let i = 0
    const timer = setInterval(() => {
      i += 1
      setProgress(i)
      if (i >= ids.length) clearInterval(timer)
    }, 620)

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: trimmed, targetType, dimensions: selected }),
      })
      const json = (await res.json()) as { report?: ResearchReport; error?: string }
      if (!res.ok || !json.report) {
        throw new Error(json.error ?? "侦察失败")
      }
      setReport(json.report)
    } catch (e) {
      setError(e instanceof Error ? e.message : "侦察失败，请稍后重试")
    } finally {
      clearInterval(timer)
      setRunning(false)
    }
  }

  function reset() {
    setReport(null)
    setShowPlan(false)
    setProgress(0)
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* 输入区 */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex flex-col gap-2">
          <label htmlFor="research-target" className="text-sm font-medium">
            侦察目标
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="research-target"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value)
                if (report) reset()
              }}
              placeholder="粘贴合约地址、输入代币符号或项目名，例如 0x… / WETH / uniswap"
              className="flex-1 rounded-xl border bg-background px-4 py-2.5 text-sm outline-none transition-colors focus:border-primary"
            />
            <div className="flex shrink-0 gap-1 rounded-xl border bg-muted/50 p-1">
              {TARGET_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTargetType(t.id)
                    if (report) reset()
                  }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    targetType === t.id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title={t.hint}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            合约安全与链上维度需要 <span className="text-foreground">0x 地址</span>；代币维度走
            DefiLlama，项目名可查协议 TVL。
          </p>
        </div>

        {/* 维度多选 */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">选择要挖的维度</p>
          <div className="flex flex-wrap gap-2">
            {RESEARCH_DIMENSIONS.map((d) => {
              const Icon = d.Icon
              const on = selected.includes(d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDimension(d.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    on
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  {d.title}
                  {!d.live ? <span className="text-[10px] opacity-70">（未接入）</span> : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={start}
            disabled={!canRun}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors",
              canRun
                ? "bg-primary text-black hover:opacity-90"
                : "cursor-not-allowed bg-muted text-muted-foreground",
            )}
          >
            {running ? <RiLoader4Line className="size-4 animate-spin" /> : <RiSearchLine className="size-4" />}
            {running ? "正在拉取真实链上数据…" : "开始侦察"}
          </button>
          {report ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <RiRefreshLine className="size-4" /> 重新侦察
            </button>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-600 dark:text-red-400">
            <RiAlertLine className="mt-0.5 size-4 shrink-0" />
            {error}
          </p>
        ) : null}
      </div>

      {/* 运行中：逐维度挖掘进度 */}
      {running ? (
        <div className="rounded-2xl border bg-card p-5">
          <p className="text-sm font-medium">正在逐维度拉取真实数据</p>
          <ul className="mt-3 space-y-2">
            {RESEARCH_DIMENSIONS.filter((d) => selected.includes(d.id)).map((d, idx) => {
              const Icon = d.Icon
              const done = idx < progress
              const active = idx === progress
              return (
                <li key={d.id} className="flex items-center gap-2 text-sm">
                  {done ? (
                    <RiCheckboxCircleLine className="size-4 text-emerald-500" />
                  ) : active ? (
                    <RiLoader4Line className="size-4 animate-spin text-primary" />
                  ) : (
                    <RiSearchLine className="size-4 text-muted-foreground" />
                  )}
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                  <span className={cn(done ? "text-foreground" : "text-muted-foreground")}>
                    {d.title}
                  </span>
                  {!d.live ? (
                    <span className="text-[10px] text-muted-foreground">（数据源未接入，将不给数值）</span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {/* 报告区 */}
      {report ? <ReportView report={report} showPlan={showPlan} setShowPlan={setShowPlan} /> : null}
    </div>
  )
}

/* ----------------------------- 报告视图 ----------------------------- */

function ReportView({
  report,
  showPlan,
  setShowPlan,
}: {
  report: ResearchReport
  showPlan: boolean
  setShowPlan: (v: boolean) => void
}) {
  const overall = report.overallRisk
    ? RISK_STYLE[report.overallRisk]
    : UNAVAILABLE_STYLE
  const noData = report.liveCount === 0

  return (
    <div className="space-y-5">
      {/* 数据源声明 */}
      <div
        className={cn(
          "flex items-start gap-3 rounded-2xl border p-4",
          noData ? "border-red-500/30 bg-red-500/5" : "border-border bg-muted/30",
        )}
      >
        <RiShieldCheckLine
          className={cn("mt-0.5 size-5 shrink-0", noData ? "text-red-500" : "text-emerald-600 dark:text-emerald-400")}
          aria-hidden
        />
        <div className="text-xs leading-6 text-muted-foreground">
          <p>
            本报告只呈现<span className="text-foreground">真实抓取到的数据</span>（Sourcify 源码验证 /
            Alchemy 链上 RPC / DefiLlama 行情与 TVL），
            <span className="text-foreground">不含任何模拟或占位数值</span>。
          </p>
          <p className="mt-1">
            本次：
            <span className="text-foreground"> {report.liveCount} 个维度取到真实数据</span>
            {report.unavailableCount > 0 ? (
              <>
                ，
                <span className="text-foreground">{report.unavailableCount} 个维度数据源未接入</span>
                ——这些维度不给任何数值与判断。
              </>
            ) : (
              "。"
            )}
          </p>
        </div>
      </div>

      {/* 综合结论卡 */}
      <div className={cn("rounded-2xl border p-5", overall.bg, overall.border)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">综合结论 · 对「{report.target}」</p>
            <p className={cn("mt-1 text-2xl font-semibold", overall.text)}>
              {noData ? "未取到真实数据" : `定性：${RISK_LABEL[report.overallRisk!]}`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RiShieldCheckLine className="size-4" aria-hidden />
            {report.targetType === "contract" ? "合约" : report.targetType === "token" ? "代币" : "项目"}侦察
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-foreground/90">{report.verdict}</p>
        {!noData ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            说明：已移除 0-100 风险分——现有真实事实不足以支撑评分精度，编造分数等同于假数据。
          </p>
        ) : null}
      </div>

      {/* 维度卡 */}
      <div className="grid gap-4 md:grid-cols-2">
        {report.dimensions.map((d) => (
          <DimensionCard key={d.id} d={d} />
        ))}
      </div>

      {/* 执行步骤 */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <RiPenNibLine className="size-4 text-primary" aria-hidden />
              决定执行？AI 给你步骤草稿
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              服务端不托管私钥，AI 只生成可逐步签名的草稿，真正签名由你的钱包完成。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPlan(!showPlan)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
          >
            {showPlan ? "收起步骤" : "我要执行"}
            <RiArrowRightLine className={cn("size-4 transition-transform", showPlan && "rotate-90")} />
          </button>
        </div>

        {showPlan ? (
          <ol className="mt-4 space-y-3">
            {report.executionPlan.map((step) => (
              <ExecutionRow key={step.order} step={step} />
            ))}
          </ol>
        ) : null}
      </div>
    </div>
  )
}

function DimensionCard({ d }: { d: DimensionFinding }) {
  const meta = RESEARCH_DIMENSIONS.find((x) => x.id === d.id)!
  const Icon = meta.Icon
  const isLive = d.status === "live"
  const style = d.riskLevel ? RISK_STYLE[d.riskLevel] : UNAVAILABLE_STYLE

  // 未接入：不给任何数值、不渲染信号格
  if (!isLive) {
    return (
      <article className="flex flex-col rounded-2xl border border-dashed bg-card/50 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-muted-foreground" aria-hidden />
            <h3 className="text-sm font-semibold text-muted-foreground">{d.title}</h3>
          </div>
          <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
            数据源未接入
          </span>
        </div>

        <p className="mt-2 text-xs leading-5 text-muted-foreground">{d.unavailableReason ?? d.summary}</p>

        <p className="mt-3 flex items-center gap-1 border-t pt-2 text-[11px] text-muted-foreground">
          数据源：{d.dataSourceLabel}
          <a href="/ai/tools" className="inline-flex items-center gap-0.5 text-primary hover:underline">
            查看选型 <RiExternalLinkLine className="size-3" />
          </a>
        </p>
      </article>
    )
  }

  return (
    <article className="flex flex-col rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold">{d.title}</h3>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
            style.border,
            style.bg,
            style.text,
          )}
        >
          {d.riskLevel ? RISK_LABEL[d.riskLevel] : "—"}
        </span>
      </div>

      <p className="mt-2 text-xs leading-5 text-muted-foreground">{d.summary}</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {d.signals.map((s) => (
          <div key={s.label} className="rounded-lg border bg-muted/40 px-2.5 py-1.5">
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
            <p className={cn("text-xs font-semibold", TONE_TEXT[s.tone])}>{s.value}</p>
          </div>
        ))}
      </div>

      {d.recommendations.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {d.recommendations.map((r) => (
            <li key={r} className="flex items-start gap-1.5 text-xs leading-5 text-muted-foreground">
              <RiCheckboxCircleLine className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
              {r}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">
        <p className="flex items-center gap-1">
          数据源：{d.dataSourceLabel}
          <span className="text-emerald-600 dark:text-emerald-400">· 真实数据</span>
        </p>
        {d.basis ? <p className="mt-1 leading-5 opacity-80">{d.basis}</p> : null}
      </div>
    </article>
  )
}

function ExecutionRow({ step }: { step: ExecutionStep }) {
  const style = RISK_STYLE[step.riskLevel]
  return (
    <li className="flex gap-3 rounded-xl border bg-muted/30 p-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
        {step.order}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{step.action}</p>
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", style.border, style.bg, style.text)}>
            {RISK_LABEL[step.riskLevel]}
          </span>
          {step.requiresSignature ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              需钱包签名
            </span>
          ) : (
            <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">无需签名</span>
          )}
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p>
      </div>
    </li>
  )
}
