import { requireRwaSubject } from "@/lib/agents/http"
import { readGrantState, summarizeUsage } from "@/lib/neon/agent-billing"
import { isWaffoTestMode } from "@/lib/waffo/client"
import {
  AGENT_GRANT_VALIDITY_DAYS,
  AGENT_SERVICE_PRICE_USD,
  AGENT_TOKEN_BUDGET_USD,
} from "@/lib/agents/billing-config"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * 当前用户的付费状态：还有多少额度、什么时候过期、是否测试模式。
 * 前端据此决定「直接开始任务」还是「先购买」。
 */
export async function GET() {
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response
  try {
    const state = await readGrantState(auth.subject)
    const usage = await summarizeUsage(auth.subject)
    return Response.json({
      hasGrant: Boolean(state.grant),
      remainingUsd: state.remainingUsd,
      validDaysLeft: state.validDaysLeft,
      expiresAt: state.grant?.expiresAt ?? null,
      budgetUsd: AGENT_TOKEN_BUDGET_USD,
      priceUsd: AGENT_SERVICE_PRICE_USD,
      validityDays: AGENT_GRANT_VALIDITY_DAYS,
      testMode: isWaffoTestMode(),
      usage,
      grants: state.grants.map((grant) => ({
        id: grant.id,
        status: grant.status,
        sourceOrderId: grant.sourceOrderId,
        grantedAt: grant.grantedAt,
        expiresAt: grant.expiresAt,
        tokenBudgetUsd: grant.tokenBudgetUsd,
        tokenUsedUsd: grant.tokenUsedUsd,
      })),
    })
  } catch (error) {
    console.error("[credits] 读取付费状态失败:", error)
    return Response.json(
      { error: { code: "CREDITS_UNAVAILABLE", message: "读取付费状态失败" } },
      { status: 500 },
    )
  }
}
