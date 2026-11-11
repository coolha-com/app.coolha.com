import "server-only"

import { randomUUID } from "node:crypto"
import { generateText } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import {
  INFERENCE_API_KEY,
  INFERENCE_BASE_URL,
  INFERENCE_GATEWAY_NAME,
  INFERENCE_NOT_CONFIGURED,
  isInferenceReady,
  resolveInferenceModel,
} from "@/lib/inference/config"
import { recordUsage } from "@/lib/neon/ai-usage"
import { checkQuota, consumeQuota } from "@/lib/neon/quota"
import { REPORT_DISCLAIMER } from "@/lib/research/labels"
import type { StoredResearchReport } from "@/lib/agents/rwa-research"

export interface NarrativeOutcome {
  text: string | null
  source: "none" | "sponsored"
  note: string
}

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : "模型整理失败"
  return message.replace(/sk-[A-Za-z0-9]+/g, "[redacted]").slice(0, 240)
}

/**
 * 用平台推理网关把已取到的事实再讲一遍。
 * 失败不影响报告本身。不接收、不记录任何用户密钥。
 *
 * Vercel AI Gateway 已永久停用，这里改走统一 OpenAI 兼容网关
 * （src/lib/inference/config.ts），与 eve Agent 是同一个端点。
 */
export async function narrateSponsoredReport(input: {
  subject: string
  slug: string
  report: StoredResearchReport
}): Promise<NarrativeOutcome> {
  if (!isInferenceReady() || process.env.FREE_MODELS_ENABLED === "0") {
    return {
      text: null,
      source: "none",
      note: `${INFERENCE_NOT_CONFIGURED.message}，已保存结构化事实报告。`,
    }
  }

  // 旧目录 slug 不再有效：统一按 INFERENCE_MODELS 白名单收敛，只放行平台模型
  const modelId = resolveInferenceModel(input.slug)
  if (!modelId) {
    return {
      text: null,
      source: "none",
      note: `${INFERENCE_NOT_CONFIGURED.message}，已保存结构化事实报告。`,
    }
  }

  const quota = await checkQuota(input.subject)
  if (!quota.allowed) {
    return {
      text: null,
      source: "none",
      note: "今日平台额度已用完，已保存结构化事实报告。额度与订单档位无关。",
    }
  }

  const startedAt = Date.now()
  const provider = createOpenAICompatible({
    name: INFERENCE_GATEWAY_NAME,
    baseURL: INFERENCE_BASE_URL,
    apiKey: INFERENCE_API_KEY,
    includeUsage: true,
  })

  try {
    const result = await generateText({
      model: provider(modelId),
      system: [
        "你只转述用户给出的 JSON 里已经出现的事实。",
        "每条事实写明 dataSourceLabel，时间使用 createdAt。",
        "status 为 unavailable 或 riskLevel 为 null 时，照实说明本次没有结论。",
        "不要补充 JSON 以外的数值，不要打 0 到 100 的分数。",
        "不要建议签名、授权、转账或兑换。",
        "不要写成投资建议或审计结论。",
      ].join("\n"),
      prompt: JSON.stringify(input.report),
      maxOutputTokens: 700,
      abortSignal: AbortSignal.timeout(20_000),
    })
    const text = result.text.trim()
    const usage = result.usage as { inputTokens?: number; outputTokens?: number }
    const inputTokens = usage.inputTokens ?? 0
    const outputTokens = usage.outputTokens ?? 0
    await consumeQuota(input.subject, inputTokens, outputTokens).catch(() => undefined)
    await recordUsage({
      requestId: `rwa_${randomUUID()}`,
      modelId,
      providerId: "inference",
      source: "rwa-research",
      subject: input.subject,
      walletAddress: null,
      inputTokens,
      outputTokens,
      costUsd: 0,
      latencyMs: Date.now() - startedAt,
      status: "success",
    }).catch(() => undefined)
    return {
      text: text || null,
      source: text ? "sponsored" : "none",
      note: text
        ? `由平台模型 ${modelId} 根据本次事实整理。${REPORT_DISCLAIMER}`
        : "平台模型没有返回文字，已保存结构化事实报告。",
    }
  } catch (error) {
    await recordUsage({
      requestId: `rwa_err_${randomUUID()}`,
      modelId,
      providerId: "inference",
      source: "rwa-research",
      subject: input.subject,
      walletAddress: null,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      latencyMs: Date.now() - startedAt,
      status: "error",
      errorCode: "NARRATIVE_FAILED",
    }).catch(() => undefined)
    return {
      text: null,
      source: "none",
      note: `平台模型整理失败（${publicError(error)}）。结构化事实报告已保存。`,
    }
  }
}
