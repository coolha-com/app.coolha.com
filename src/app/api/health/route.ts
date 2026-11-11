import { isAuthConfigured } from "@/lib/neon/auth"
import { isDatabaseConfigured, query } from "@/lib/neon/postgres"
import { isAlchemyConfigured } from "@/lib/web3-tools/alchemy"
import {
  INFERENCE_GATEWAY_NAME,
  inferenceModelIds,
  isInferenceConfigured,
  isInferenceReady,
} from "@/lib/inference/config"

export const dynamic = "force-dynamic"

interface ServiceStatus {
  configured: boolean
  ok: boolean
  detail: string
}

/**
 * 服务健康检查：Postgres 实际 ping，其余服务报告配置状态。
 *
 * 2026-11-11：Vercel AI Gateway 永久停用，aiGateway / neonAiGateway / 目录同步
 * 检查项已移除。推理通道只看统一网关 INFERENCE_*（唯一真相源）。
 * 未配置时如实报「未接入」，不因变量存在就误报可用。
 */
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

  const configured = isInferenceConfigured()
  const ready = isInferenceReady()
  const modelCount = inferenceModelIds().length

  const services = {
    postgres,
    auth: {
      configured: isAuthConfigured(),
      ok: isAuthConfigured(),
      detail: isAuthConfigured() ? "NEON_AUTH_BASE_URL 已配置" : "未配置",
    },
    inference: {
      configured: ready,
      ok: ready,
      detail: ready
        ? `${INFERENCE_GATEWAY_NAME} 已接入（${modelCount} 个模型）`
        : configured
          ? "INFERENCE_BASE_URL / INFERENCE_API_KEY 已配置，但 INFERENCE_MODELS 为空"
          : "推理网关未接入（INFERENCE_NOT_CONFIGURED）：eve Agent 派单会如实返回 503",
      gateway: INFERENCE_GATEWAY_NAME,
      modelCount,
    },
    platformModels: {
      configured: process.env.FREE_MODELS_ENABLED !== "0",
      ok: process.env.FREE_MODELS_ENABLED !== "0" && ready,
      detail:
        process.env.FREE_MODELS_ENABLED === "0"
          ? "FREE_MODELS_ENABLED=0，已熔断"
          : ready
            ? "平台模型通道开启"
            : "通道开启但推理网关未接入",
    },
    alchemy: {
      configured: isAlchemyConfigured(),
      ok: isAlchemyConfigured(),
      detail: isAlchemyConfigured()
        ? "ALCHEMY_KEY 已配置（/data/tools 的 Alchemy 读链可用）"
        : "未配置（/data/tools 的 Alchemy 读链将返回「未接入」，不返回任何链上数值）",
    },
  }

  return Response.json(
    {
      ok: postgres.ok,
      // 推理网关未接入不算数据库不健康，单独由 services.inference 表达
      degraded: false,
      services,
    },
    { status: postgres.ok ? 200 : 503 },
  )
}
