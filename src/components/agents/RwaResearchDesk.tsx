"use client"

import { useState } from "react"
import { streamCustomModel } from "@/lib/compute/byok-client"
import { useConnections } from "@/lib/compute/connections"
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
  const connections = useConnections()
  const [modelMode, setModelMode] = useState<"sponsored" | "byok">(
    initialProfile?.modelMode ?? "sponsored",
  )
  const [slug, setSlug] = useState(
    initialProfile?.sponsoredModelSlug ?? models[0]?.slug ?? "",
  )
  const [connectionId, setConnectionId] = useState(initialProfile?.byokConnectionId ?? "")
  const [modelLabel, setModelLabel] = useState(initialProfile?.byokModelLabel ?? "")
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
  const [busy, setBusy] = useState<"profile" | "run" | "narrative" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [narrativeDraft, setNarrativeDraft] = useState("")

  const selected = runs.find((run) => run.orderId === selectedId) ?? null
  const selectedConnection = connections.find((item) => item.id === connectionId) ?? null
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
          modelMode,
          sponsoredModelSlug: modelMode === "sponsored" ? slug : null,
          byokConnectionId: modelMode === "byok" ? connectionId : null,
          byokModelLabel: modelMode === "byok" ? modelLabel : null,
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
      setNarrativeDraft("")
    } catch {
      setError("提交任务失败")
    } finally {
      setBusy(null)
    }
  }

  async function narrateInBrowser() {
    if (!selected || !selected.report) return
    const connection = connections.find(
      (item) => item.id === selected.profileSnapshot.byokConnectionId,
    )
    const model = selected.profileSnapshot.byokModelLabel
    if (!connection || !model) {
      setError("这台浏览器里没有 Profile 保存的那个 BYOK 连接")
      return
    }
    setBusy("narrative")
    setError(null)
    setNarrativeDraft("")
    let text = ""
    try {
      await streamCustomModel({
        baseURL: connection.baseURL,
        apiKey: connection.apiKey,
        model,
        messages: [
          {
            role: "system",
            content:
              "只转述 JSON 里已经出现的事实，并写明数据来源和 createdAt。不要补充数值，不要打分，不要建议签名、转账或兑换。",
          },
          { role: "user", content: JSON.stringify(selected.report) },
        ],
        onDelta: (delta) => {
          text += delta
          setNarrativeDraft(text)
        },
      })
      if (!text.trim()) {
        setError("浏览器内模型没有返回文字")
        return
      }
      const response = await fetch(`/api/agents/rwa-research/runs/${selected.orderId}/narrative`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      if (!response.ok) {
        setError(await readError(response))
        return
      }
      const body = (await response.json()) as { run: ResearchRunView }
      setRuns((current) => current.map((item) => (item.orderId === body.run.orderId ? body.run : item)))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "浏览器内模型调用失败")
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
          保存 Profile 和提交任务需要先在侧边栏连接钱包并签名登录。
        </p>
      ) : null}

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-medium">Agent Profile</h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          勾选列表只包含工具目录里已经标成已接入的只读工具。报告里的来源是这次实际取到数据的数据源。
        </p>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-sm">模型</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="model-mode"
              checked={modelMode === "sponsored"}
              onChange={() => setModelMode("sponsored")}
            />
            平台赞助模型
          </label>
          {modelMode === "sponsored" ? (
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
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="model-mode"
              checked={modelMode === "byok"}
              onChange={() => setModelMode("byok")}
            />
            浏览器内 BYOK（密钥留在这台浏览器）
          </label>
          {modelMode === "byok" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                className="rounded-xl border bg-background px-3 py-2 text-sm"
                value={connectionId}
                onChange={(event) => {
                  setConnectionId(event.target.value)
                  const next = connections.find((item) => item.id === event.target.value)
                  setModelLabel(next?.models[0] ?? "")
                }}
              >
                <option value="">选择本地连接</option>
                {connections.filter((item) => item.enabled).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-xl border bg-background px-3 py-2 text-sm"
                value={modelLabel}
                onChange={(event) => setModelLabel(event.target.value)}
              >
                <option value="">选择模型名称</option>
                {(selectedConnection?.models ?? []).map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
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
                    onClick={() => {
                      setSelectedId(run.orderId)
                      setNarrativeDraft("")
                    }}
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

      {selected?.profileSnapshot.modelMode === "byok" && selected.status === "succeeded" ? (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="text-sm font-medium">浏览器内整理</h2>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            调用发往你自己的模型端点。密钥不会发给 Coolha。整理文字不是新的链上事实。
          </p>
          {narrativeDraft ? (
            <pre className="mt-3 whitespace-pre-wrap text-sm">{narrativeDraft}</pre>
          ) : null}
          <Button
            type="button"
            className="mt-3"
            variant="outline"
            onClick={narrateInBrowser}
            disabled={busy !== null}
          >
            {busy === "narrative" ? "整理中" : "用浏览器里的模型整理"}
          </Button>
        </section>
      ) : null}

      <section className="space-y-2 text-xs leading-5 text-muted-foreground">
        {REPORT_DISCLAIMER_DETAILED.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </section>
    </div>
  )
}
