import { isAuthConfigured } from "@/lib/neon/auth"
import { isAiGatewayConfigured as isNeonGatewayConfigured } from "@/lib/neon/ai-gateway"
import { gatewayErrorCode, isAiGatewayConfigured, isRealGatewayFailure } from "@/lib/ai-gateway/client"
import { isDatabaseConfigured, query } from "@/lib/neon/postgres"

export const dynamic = "force-dynamic"

interface ServiceStatus {
  configured: boolean
  ok: boolean
  detail: string
}

/**
 * 目录同步元信息（只读单行，不拉全量模型）。
 * 未接线数据库时返回空状态，调用方据此把 key 视为「仅已配置、未验证」。
 */
async function readCatalogHealth(): Promise<{
  syncedAt: string | null
  failedAt: string | null
  modelCount: number
  lastError: string | null
}> {
  const empty = { syncedAt: null, failedAt: null, modelCount: 0, lastError: null }
  if (!isDatabaseConfigured()) return empty

  try {
    const { rows } = await query<{
      synced_at: Date
      failed_at: Date | null
      model_count: number
      last_error: string | null
    }>(
      `SELECT synced_at, failed_at, model_count, last_error
       FROM model_catalog_sync WHERE id = 1`,
    )
    const row = rows[0]
    if (!row) return empty
    return {
      syncedAt: row.synced_at?.toISOString() ?? null,
      failedAt: row.failed_at ? row.failed_at.toISOString() : null,
      modelCount: row.model_count ?? 0,
      lastError: row.last_error,
    }
  } catch {
    return empty
  }
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

  // 目录同步状态：key「已配置」不等于「可用」。401/429 都要在这里显形，
  // 否则运维只能靠翻服务端日志才发现 key 已失效（目录会静默退化为陈旧快照）。
  const catalog = await readCatalogHealth()
  // RENDER_ABORTED 只是静态预渲染被框架中断（正常路径），不算网关故障
  const gatewayDown = isRealGatewayFailure(catalog.lastError)

  const services = {
    postgres,
    auth: {
      configured: isAuthConfigured(),
      ok: isAuthConfigured(),
      detail: isAuthConfigured() ? "NEON_AUTH_BASE_URL 已配置" : "未配置",
    },
    // 实际推理通道：Vercel AI Gateway（AI_GATEWAY_API_KEY）
    aiGateway: {
      configured: isAiGatewayConfigured(),
      ok: isAiGatewayConfigured() && !gatewayDown,
      detail: gatewayDown
        ? `已配置但回源失败：${gatewayErrorCode(catalog.lastError)}（${catalog.modelCount} 个模型仍由陈旧快照兜底）`
        : isAiGatewayConfigured()
          ? "AI_GATEWAY_API_KEY 已配置"
          : "AI_GATEWAY_API_KEY 未配置（免费模型通道不可用）",
      lastSyncedAt: catalog.syncedAt,
      modelCount: catalog.modelCount,
      lastError: catalog.lastError ? gatewayErrorCode(catalog.lastError) : null,
      failedAt: catalog.failedAt,
    },
    // 备用通道：Neon AI Gateway（NEON_AI_GATEWAY_TOKEN），仅 /api/neon/ai 使用
    neonAiGateway: {
      configured: isNeonGatewayConfigured(),
      ok: isNeonGatewayConfigured(),
      detail: isNeonGatewayConfigured()
        ? "NEON_AI_GATEWAY_TOKEN 已配置"
        : "未配置（仅 /api/neon/ai 依赖，不影响免费模型）",
    },
    freeModels: {
      configured: process.env.FREE_MODELS_ENABLED !== "0",
      // key 已配置但回源 401 时，推理实际不可用 —— 不能只凭变量存在就报 ok
      ok:
        process.env.FREE_MODELS_ENABLED !== "0" &&
        isAiGatewayConfigured() &&
        !gatewayDown,
      detail:
        process.env.FREE_MODELS_ENABLED === "0"
          ? "FREE_MODELS_ENABLED=0，已熔断"
          : gatewayDown
            ? `通道开启但回源失败：${gatewayErrorCode(catalog.lastError)}`
            : "免费模型通道开启",
    },
  }

  return Response.json(
    {
      ok: postgres.ok,
      // 网关回源失败时整体不算健康，便于外部探针/监控直接报警
      degraded: gatewayDown,
      services,
    },
    { status: postgres.ok && !gatewayDown ? 200 : 503 },
  )
}
