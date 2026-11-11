"use client"

import { useState } from "react"
import Link from "next/link"
import { REPORT_DISCLAIMER_DETAILED } from "@/lib/research/labels"
import {
  listConnectedReadTools,
  PAYMENT_GAP,
  type ResearchRunView,
  type SavedProfile,
  type TaskConstraints,
} from "@/lib/agents/rwa-research"
import { ResearchRunArticle } from "@/components/agents/ResearchRunArticle"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const TOOLS = listConnectedReadTools()

const CONSTRAINTS: { key: keyof TaskConstraints; label: string; detail: string }[] = [
  { key: "readOnly", label: "只读", detail: "不签名、不转账、不兑换" },
  { key: "citeSources", label: "必须标注来源", detail: "事实带数据来源和抓取时间" },
  { key: "unverifiedNotFact", label: "不得把未验证信息当事实", detail: "没取到的维度保持未接入，不补数值" },
]

interface ModelOption {
  slug: string
  name: string
  providerName: string
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
  return body?.error?.message ?? `请求失败（${response.status}）`
}

export function RwaResearchDesk({
  signedIn,
  models,
  initialProfile,
  initialRuns,
}: {
  signedIn: boolean
  models: ModelOption[]
  initialProfile: SavedProfile | null
  initialRuns: ResearchRunView[]
}) {
  // 自带模型通道已下线：只保留平台模型，历史 Profile 里的 byok 字段不再读取。
  const [slug, setSlug] = useState(
    initialProfile?.sponsoredModelSlug ?? models[0]?.slug ?? "",
  )
  const [allowed, setAllowed] = useState<string[]>(
    initialProfile?.allowedToolIds ?? TOOLS.map((tool) => tool.id),
  )
  const [constraints, setConstraints] = useState<TaskConstraints>(
    initialProfile?.constraints ?? {
      readOnly: true,
      citeSources: true,
      unverifiedNotFact: true,
    },
  )
  const [profileMessage, setProfileMessage] = useState<string | null>(
    initialProfile ? `已保存于 ${initialProfile.updatedAt}` : null,
  )
  const [task, setTask] = useState("")
  const [targetType, setTargetType] = useState<"contract" | "token" | "project">("contract")
  const [runs, setRuns] = useState<ResearchRunView[]>(initialRuns)
  const [selectedId, setSelectedId] = useState<string | null>(initialRuns[0]?.orderId ?? null)
  const [busy, setBusy] = useState<"profile" | "run" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selected = runs.find((run) => run.orderId === selectedId) ?? null
  const constraintsOk =
    constraints.readOnly && constraints.citeSources && constraints.unverifiedNotFact

  function toggleTool(id: string) {
    setAllowed((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  async function saveProfile() {
    setBusy("profile")
    setError(null)
    try {
      const response = await fetch("/api/agents/rwa-research/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelMode: "sponsored",
          sponsoredModelSlug: slug,
          byokConnectionId: null,
          byokModelLabel: null,
          allowedToolIds: allowed,
          constraints,
        }),
      })
      if (!response.ok) {
        setError(await readError(response))
        return
      }
      const body = (await response.json()) as { profile: SavedProfile }
      setProfileMessage(`已保存于 ${body.profile.updatedAt}`)
    } catch {
      setError("保存 Profile 失败")
    } finally {
      setBusy(null)
    }
  }

  async function submitTask() {
    setBusy("run")
    setError(null)
    try {
      const response = await fetch("/api/agents/rwa-research/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, targetType }),
      })
      if (!response.ok) {
        setError(await readError(response))
        return
      }
      const body = (await response.json()) as { run: ResearchRunView }
      setRuns((current) => [body.run, ...current.filter((item) => item.orderId !== body.run.orderId)])
      setSelectedId(body.run.orderId)
    } catch {
      setError("提交任务失败")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-medium">订单与价格</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">服务</dt>
            <dd>RWA Research</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">标价</dt>
            <dd>未公布</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">展示币种</dt>
            <dd>USD（没有收款金额）</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">付款状态</dt>
            <dd>未付款</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">链上结算</dt>
            <dd>未接入</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-6 text-muted-foreground">{PAYMENT_GAP}</p>
      </section>

      {!signedIn ? (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          保存 Profile 和提交任务需要先登入。
        </p>
      ) : null}

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-medium">Agent Profile</h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          勾选列表只包含工具目录里已经标成已接入的只读工具。报告里的来源是这次实际取到数据的数据源。
        </p>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-sm">模型</legend>
          <p className="text-xs leading-5 text-muted-foreground">平台模型（自带模型通道已下线）</p>
          <select
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          >
            {models.length === 0 ? <option value="">目录暂不可用</option> : null}
            {models.map((model) => (
              <option key={model.slug} value={model.slug}>
                {model.providerName} / {model.name}
              </option>
            ))}
          </select>
        </fieldset>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-sm">已接入工具</legend>
          {TOOLS.length === 0 ? (
            <p className="text-sm text-muted-foreground">当前没有已接入的只读工具。</p>
          ) : (
            TOOLS.map((tool) => (
              <label key={tool.id} className="block rounded-xl border p-3 text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allowed.includes(tool.id)}
                    onChange={() => toggleTool(tool.id)}
                  />
                  <span className="font-medium">{tool.name}</span>
                  <span className="text-xs text-muted-foreground">允许</span>
                </span>
                {tool.liveScope ? (
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{tool.liveScope}</span>
                ) : null}
              </label>
            ))
          )}
        </fieldset>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-sm">任务约束</legend>
          {CONSTRAINTS.map((item) => (
            <label key={item.key} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={constraints[item.key]}
                onChange={(event) =>
                  setConstraints((current) => ({ ...current, [item.key]: event.target.checked }))
                }
              />
              <span>
                <span className="font-medium">{item.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{item.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="mt-4 flex items-center gap-3">
          <Button type="button" onClick={saveProfile} disabled={busy !== null || !constraintsOk}>
            {busy === "profile" ? "保存中" : "保存 Profile"}
          </Button>
          {profileMessage ? <span className="text-xs text-muted-foreground">{profileMessage}</span> : null}
        </div>
        {!constraintsOk ? (
          <p className="mt-2 text-xs text-muted-foreground">三条约束都打开后才能保存和执行。</p>
        ) : null}
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-medium">提交任务</h2>
        <label className="mt-3 block text-sm" htmlFor="rwa-task">
          研究任务
        </label>
        <textarea
          id="rwa-task"
          className="mt-1 min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm"
          value={task}
          maxLength={2000}
          onChange={(event) => setTask(event.target.value)}
          placeholder="例如：核查 0x… 的只读事实"
        />
        <label className="mt-3 block text-sm" htmlFor="rwa-type">
          目标类型
        </label>
        <select
          id="rwa-type"
          className="mt-1 rounded-xl border bg-background px-3 py-2 text-sm"
          value={targetType}
          onChange={(event) => setTargetType(event.target.value as "contract" | "token" | "project")}
        >
          <option value="contract">合约</option>
          <option value="token">代币</option>
          <option value="project">项目</option>
        </select>
        <div className="mt-4">
          <Button type="button" onClick={submitTask} disabled={busy !== null || task.trim().length < 2}>
            {busy === "run" ? "执行中" : "提交并执行"}
          </Button>
        </div>
      </section>

      {error ? <p className="rounded-xl border border-destructive/40 p-3 text-sm">{error}</p> : null}

      <section className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <div className="rounded-2xl border bg-card p-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="text-sm font-medium">执行记录</h2>
            <Link href="/tasks" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
              全部任务
            </Link>
          </div>
          {runs.length === 0 ? (
            <p className="px-1 py-3 text-xs text-muted-foreground">还没有执行记录。</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {runs.map((run) => (
                <li key={run.orderId}>
                  <button
                    type="button"
                    className={cn(
                      "w-full rounded-xl px-2 py-2 text-left text-xs",
                      selectedId === run.orderId ? "bg-primary/10" : "hover:bg-accent",
                    )}
                    onClick={() => setSelectedId(run.orderId)}
                  >
                    <span className="block truncate">{run.target}</span>
                    <span className="text-muted-foreground">
                      {run.status} · 未付款 · {run.createdAt.slice(0, 19).replace("T", " ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>{selected ? <ResearchRunArticle run={selected} /> : null}</div>
      </section>

      <section className="space-y-2 text-xs leading-5 text-muted-foreground">
        {REPORT_DISCLAIMER_DETAILED.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </section>
    </div>
  )
}
