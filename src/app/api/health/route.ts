import { isAuthConfigured } from "@/lib/neon/auth"
import { isAiGatewayConfigured } from "@/lib/neon/ai-gateway"
import { isDatabaseConfigured, query } from "@/lib/neon/postgres"

export const dynamic = "force-dynamic"

interface ServiceStatus {
  configured: boolean
  ok: boolean
  detail: string
}

/** 服务健康检查：Postgres 实际 ping，Auth / AI Gateway 报告配置状态 */
export async function GET() {
  const postgres: ServiceStatus = {
    configured: isDatabaseConfigured(),
    ok: false,
    detail: "",
  }

  if (postgres.configured) {
    try {
      const { rows } = await query<{ version: string; database: string }>(
        "SELECT version() AS version, current_database() AS database",
      )
      postgres.ok = true
      postgres.detail = `${rows[0]?.database ?? "unknown"} · ${(rows[0]?.version ?? "").split(" ").slice(0, 2).join(" ")}`
    } catch (error) {
      postgres.detail = error instanceof Error ? error.message : "unknown error"
    }
  } else {
    postgres.detail = "DATABASE_URL 未配置"
  }

  const services = {
    postgres,
    auth: {
      configured: isAuthConfigured(),
      ok: isAuthConfigured(),
      detail: isAuthConfigured() ? "NEON_AUTH_BASE_URL 已配置" : "未配置",
    },
    aiGateway: {
      configured: isAiGatewayConfigured(),
      ok: isAiGatewayConfigured(),
      detail: isAiGatewayConfigured() ? "NEON_AI_GATEWAY_TOKEN 已配置" : "未配置",
    },
  }

  return Response.json(
    { ok: postgres.ok, services },
    { status: postgres.ok ? 200 : 503 },
  )
}
