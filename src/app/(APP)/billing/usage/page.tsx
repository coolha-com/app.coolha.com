import type { Metadata } from "next"
import Link from "next/link"
import { ModulePage } from "@/components/compute/ModulePage"
import { ProviderLogo } from "@/components/compute/ProviderLogo"
import { listRecentUsage, summarizeUsage } from "@/lib/neon/ai-usage"
import { getWalletSessionFromCookies } from "@/lib/neon/wallet-auth"
import { resolveSubject } from "@/lib/neon/identity"
import { isDatabaseConfigured } from "@/lib/neon/postgres"
import { formatUsd } from "@/lib/compute/service"

export const metadata: Metadata = {
  title: "用量记录",
  description: "你自己的 AI Gateway 调用记录：Token 用量、成本与延迟",
}

/** 用量是实时写入的，不做缓存 */
export const dynamic = "force-dynamic"

/**
 * 示例行：仅在当前用户还没有任何真实调用时展示，用于说明表格设计。
 * 明确标注为示例，避免与真实记录混淆。
 */
const DEMO_ROWS = [
  {
    requestId: "req_example01",
    model: "example/chat-flash",
    status: "200",
    inputTokens: 1240,
    outputTokens: 386,
    costUsd: "0.000404",
    latencyMs: 1240,
    at: "2026-10-14 18:02",
  },
  {
    requestId: "req_example02",
    model: "example/reason-r1",
    status: "200",
    inputTokens: 5320,
    outputTokens: 1875,
    costUsd: "0.0156",
    latencyMs: 4820,
    at: "2026-10-14 17:48",
  },
  {
    requestId: "req_example03",
    model: "example/chat-mini",
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
  const session = await getWalletSessionFromCookies()
  const signedIn = Boolean(session?.address)

  // 用量是**私有数据**：只查当前主体自己的记录。
  // 未登录时 subject 为 null，只命中匿名记录（wallet_address IS NULL），
  // 绝不会把其他用户的钱包地址与调用明细带出来。
  const subject = signedIn ? await resolveSubject(session!.address).catch(() => null) : null

  const rows = dbReady && subject ? await listRecentUsage(subject, 50).catch(() => []) : []
  const summary =
    dbReady && subject ? await summarizeUsage(subject).catch(() => null) : null
  const hasRealData = rows.length > 0

  return (
    <ModulePage
      title="用量记录"
      description="你在 Chat 中使用免费模型的调用明细：模型、Token 用量与成本。"
    >
      <div className="space-y-4">
      {!signedIn ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span className="min-w-0 flex-1 text-foreground">
            用量记录按账号隔离，签名登录后才能查看你自己的调用明细。
          </span>
          <Link
            href="/chat"
            className="shrink-0 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            去登录
          </Link>
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="我的调用" value={summary.calls.toLocaleString("en-US")} />
          <Stat label="我的 Token" value={summary.totalTokens.toLocaleString("en-US")} />
          <Stat label="我的成本" value={formatUsd(summary.totalCostUsd)} highlight />
        </div>
      ) : null}

      {signedIn && !hasRealData ? (
        <p className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          你还没有调用记录。到 <Link href="/chat" className="underline underline-offset-4">Chat</Link> 发一条消息后，这里会显示你的用量。
        </p>
      ) : null}

      {/* 未登录时完全不渲染表格：即便有匿名记录，也不该把别人的调用明细摆在页面上 */}
      {signedIn ? (
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
                    <tr key={row.requestId} className="text-muted-foreground">
                      <td className="px-4 py-3 font-mono text-xs">{row.requestId}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.model}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
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
                      <td className="px-4 py-3 text-xs">{row.at}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
          {!hasRealData ? (
            <p className="border-t px-4 py-2 text-center text-xs text-muted-foreground">
              以上为示例数据，用于说明表格字段
            </p>
          ) : null}
        </div>
      ) : null}
      </div>
    </ModulePage>
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
