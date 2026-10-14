import type { Metadata } from "next"
import { MockBadge } from "@/components/compute/MockBadge"
import { ProviderLogo } from "@/components/compute/ProviderLogo"
import { listRecentUsage, summarizeUsage } from "@/lib/neon/ai-usage"
import { isDatabaseConfigured } from "@/lib/neon/postgres"
import { formatUsd } from "@/lib/compute/service"

export const metadata: Metadata = {
  title: "用量记录",
  description: "AI Gateway 真实调用记录：Token 用量、成本与延迟",
}

/** 用量是实时写入的，不做缓存 */
export const dynamic = "force-dynamic"

/** 示例行：仅在还没有任何真实调用时展示，用于说明表格设计 */
const DEMO_ROWS = [
  {
    requestId: "req_mock_demo01",
    model: "aurora/chat-flash",
    status: "200",
    inputTokens: 1240,
    outputTokens: 386,
    costUsd: "0.000404",
    latencyMs: 1240,
    at: "2026-10-14 18:02",
  },
  {
    requestId: "req_mock_demo02",
    model: "helios/reason-r1",
    status: "200",
    inputTokens: 5320,
    outputTokens: 1875,
    costUsd: "0.0156",
    latencyMs: 4820,
    at: "2026-10-14 17:48",
  },
  {
    requestId: "req_mock_demo03",
    model: "aurora/chat-mini",
    status: "429",
    inputTokens: 0,
    outputTokens: 0,
    costUsd: "0",
    latencyMs: 86,
    at: "2026-10-14 17:31",
  },
]

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().replace("T", " ").slice(0, 19)
}

export default async function UsagePage() {
  const dbReady = isDatabaseConfigured()
  const rows = dbReady ? await listRecentUsage(50).catch(() => []) : []
  const summary = dbReady ? await summarizeUsage().catch(() => null) : null
  const hasRealData = rows.length > 0

  return (
    <section className="mt-6 space-y-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">用量记录</h2>
        <p className="text-sm text-muted-foreground">
          Playground 每次真实调用的 Request ID、模型、Token 用量、成本与延迟，数据来自 AI Gateway。
        </p>
      </div>

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="累计调用" value={summary.calls.toLocaleString("en-US")} />
          <Stat label="累计 Token" value={summary.totalTokens.toLocaleString("en-US")} />
          <Stat label="累计成本" value={formatUsd(summary.totalCostUsd)} highlight />
        </div>
      ) : null}

      {hasRealData ? null : (
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          {dbReady
            ? "还没有真实调用记录。到 Playground 发一条消息后，这里会显示真实用量。"
            : "数据库未配置，无法读取真实用量。以下为示例数据，用于展示表格设计。"}
          <MockBadge />
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border bg-card shadow-sm">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Request ID</th>
              <th className="px-4 py-3 font-medium">模型</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 text-right font-medium">输入 Token</th>
              <th className="px-4 py-3 text-right font-medium">输出 Token</th>
              <th className="px-4 py-3 text-right font-medium">成本</th>
              <th className="px-4 py-3 text-right font-medium">耗时</th>
              <th className="px-4 py-3 font-medium">时间</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {hasRealData
              ? rows.map((row) => (
                  <tr key={row.id} className="hover:bg-accent/40">
                    <td className="px-4 py-3 font-mono text-xs">{row.request_id}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.provider_id ? (
                          <ProviderLogo
                            providerId={row.provider_id}
                            providerName={row.provider_id}
                            size={16}
                          />
                        ) : null}
                        <span className="font-mono text-xs">{row.model_id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          row.status === "success"
                            ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                            : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
                        }
                      >
                        {row.status === "success" ? "成功" : (row.error_code ?? row.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.input_tokens.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.output_tokens.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatUsd(Number(row.cost_usd))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {(row.latency_ms / 1000).toFixed(2)}s
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatTime(row.created_at)}
                    </td>
                  </tr>
                ))
              : DEMO_ROWS.map((row) => (
                  <tr key={row.requestId} className="hover:bg-accent/40">
                    <td className="px-4 py-3 font-mono text-xs">{row.requestId}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.model}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          row.status === "200"
                            ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                            : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.inputTokens.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.outputTokens.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatUsd(Number(row.costUsd))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {(row.latencyMs / 1000).toFixed(2)}s
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{row.at}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        说明：成本优先采信上游返回的用量数据；上游未回传时按目录单价线性估算。调用日志只记录计费与排错所需元数据，
        不保存完整提示词与模型回复。
      </p>
    </section>
  )
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          highlight
            ? "mt-1 text-2xl font-semibold tabular-nums text-primary"
            : "mt-1 text-2xl font-semibold tabular-nums"
        }
      >
        {value}
      </p>
    </div>
  )
}
