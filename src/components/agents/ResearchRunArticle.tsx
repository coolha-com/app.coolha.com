import { REPORT_DISCLAIMER_DETAILED, RISK_LABEL } from "@/lib/research/labels"
import type { RiskLevel, SignalTone } from "@/lib/research/types"
import type { ResearchRunView } from "@/lib/agents/rwa-research"

export function ResearchRunArticle({ run }: { run: ResearchRunView }) {
  const report = run.report
  return (
    <article className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">订单 {run.orderId}</p>
      <h2 className="mt-1 text-base font-medium">{run.target}</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        付款状态：未付款 · 标价：未公布 · 状态：{run.status}
        {run.finishedAt ? ` · 完成于 ${run.finishedAt}` : ""}
      </p>
      {run.errorMessage ? <p className="mt-3 text-sm">{run.errorMessage}</p> : null}
      {run.narrativeNote ? <p className="mt-3 text-xs leading-6 text-muted-foreground">{run.narrativeNote}</p> : null}
      {run.narrative ? (
        <div className="mt-3 rounded-xl bg-muted/40 p-3 text-sm leading-6 whitespace-pre-wrap">{run.narrative}</div>
      ) : null}
      {report ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-6">{report.verdict}</p>
          <p className="text-xs text-muted-foreground">
            抓取时间 {report.createdAt}
            {report.overallRisk ? ` · ${RISK_LABEL[report.overallRisk]}` : " · 本次缺少可判定的结论"}
          </p>
          {report.dimensions.map((dimension) => (
            <section key={dimension.id} className="rounded-xl border p-3">
              <h3 className="text-sm font-medium">{dimension.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                来源：{dimension.dataSourceLabel} · 时间：{report.createdAt}
                {dimension.riskLevel ? ` · ${RISK_LABEL[dimension.riskLevel as RiskLevel]}` : ""}
              </p>
              <p className="mt-2 text-sm leading-6">{dimension.summary}</p>
              {dimension.unavailableReason ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{dimension.unavailableReason}</p>
              ) : null}
              {dimension.basis ? (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{dimension.basis}</p>
              ) : null}
              {dimension.signals.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {dimension.signals.map((signal) => (
                    <li key={signal.label} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{signal.label}</span>
                      <span className={toneClass(signal.tone)}>{signal.value}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
          <div className="space-y-2 text-xs leading-5 text-muted-foreground">
            {REPORT_DISCLAIMER_DETAILED.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  )
}

function toneClass(tone: SignalTone): string {
  if (tone === "ok") return "text-emerald-600 dark:text-emerald-400"
  if (tone === "warn") return "text-amber-600 dark:text-amber-400"
  if (tone === "bad") return "text-red-600 dark:text-red-400"
  return "text-foreground"
}
