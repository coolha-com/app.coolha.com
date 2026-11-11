import { requireRwaSubject } from "@/lib/agents/http"
import { decideAgentAccess } from "@/lib/agents/access-mode"
import {
  AGENT_GRANT_VALIDITY_DAYS,
  AGENT_TOKEN_BUDGET_USD,
  openModeRequestCap,
} from "@/lib/agents/billing-config"
import {
  INFERENCE_DEFAULT_MODEL,
  INFERENCE_GATEWAY_NAME,
  isInferenceReady,
} from "@/lib/inference/config"
import { readGrantState, readOpenModeBudget, summarizeUsage } from "@/lib/neon/agent-billing"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * 当前用户能否执行 Agent，以及用量。
 * 不返回价格、收银台或测试购买入口。密钥不出现在响应里。
 */
export async function GET() {
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response
  const access = decideAgentAccess()
  try {
    const state = await readGrantState(auth.subject)
    const usage = await summarizeUsage(auth.subject)
    const budget = access.open ? await readOpenModeBudget(auth.subject) : null
    return Response.json({
      accessMode: access.mode,
      openAccess: access.open,
      hasGrant: Boolean(state.grant),
      remainingUsd: state.remainingUsd,
      validDaysLeft: state.validDaysLeft,
      budgetUsd: AGENT_TOKEN_BUDGET_USD,
      validityDays: AGENT_GRANT_VALIDITY_DAYS,
      openRequests: budget?.requests ?? usage.requests,
      openRequestCap: openModeRequestCap(),
      openSpendUsd: budget?.knownCostUsd ?? null,
      serviceAvailable: isInferenceReady() && (access.open || Boolean(state.grant)),
      gatewayName: INFERENCE_GATEWAY_NAME,
      defaultModel: INFERENCE_DEFAULT_MODEL,
      usage,
    })
  } catch (error) {
    console.error("[credits] 读取服务状态失败:", error instanceof Error ? error.name : "error")
    return Response.json(
      { error: { code: "CREDITS_UNAVAILABLE", message: "读取服务状态失败" } },
      { status: 500 },
    )
  }
}
