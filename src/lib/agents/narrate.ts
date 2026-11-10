import "server-only"

import { randomUUID } from "node:crypto"
import { createGateway, generateText } from "ai"
import { getCatalogModelBySlug } from "@/lib/ai-gateway/client"
import { isSponsorableModel, SPONSORED_MAX_INPUT_PRICE_PER_MILLION } from "@/lib/ai-gateway/shared"
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
 * 用平台赞助模型把已取到的事实再讲一遍。
 * 失败不影响报告本身。不接收、不记录任何用户密钥。
 */
export async function narrateSponsoredReport(input: {
  subject: string
  slug: string
  report: StoredResearchReport
}): Promise<NarrativeOutcome> {
  const apiKey = process.env.AI_GATEWAY_API_KEY
  if (!apiKey || process.env.FREE_MODELS_ENABLED === "0") {
    return {
      text: null,
      source: "none",
      note: "赞助模型通道不可用，已保存结构化事实报告。",
    }
  }

  const model = await getCatalogModelBySlug(input.slug)
  if (
    !model ||
    model.gatewayType !== "language" ||
    !isSponsorableModel(model) ||
    model.inputPricePerMillionUsd > SPONSORED_MAX_INPUT_PRICE_PER_MILLION
  ) {
    return {
      text: null,
      source: "none",
      note: "所选模型不在赞助范围内，已保存结构化事实报告。",
    }
  }

  const quota = await checkQuota(input.subject)
  if (!quota.allowed) {
    return {
      text: null,
      source: "none",
      note: "今日赞助额度已用完，已保存结构化事实报告。额度与订阅档位无关。",
    }
  }

  const startedAt = Date.now()
  try {
    const gateway = createGateway({
      apiKey,
      ...(process.env.AI_GATEWAY_BASE_URL ? { baseURL: process.env.AI_GATEWAY_BASE_URL } : {}),
    })
    const disallowTraining = process.env.AI_GATEWAY_DISALLOW_TRAINING !== "0"
    const result = await generateText({
      model: gateway(model.modelId),
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
      ...(disallowTraining
        ? { providerOptions: { gateway: { disallowPromptTraining: true } } }
        : {}),
    })
    const text = result.text.trim()
    const usage = result.usage as { inputTokens?: number; outputTokens?: number }
    const inputTokens = usage.inputTokens ?? 0
    const outputTokens = usage.outputTokens ?? 0
    await consumeQuota(input.subject, inputTokens, outputTokens).catch(() => undefined)
    await recordUsage({
      requestId: `rwa_${randomUUID()}`,
      modelId: model.modelId,
      providerId: model.providerId,
      source: "rwa-research",
      walletAddress: input.subject,
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
        ? `由赞助模型 ${model.name} 根据本次事实整理。${REPORT_DISCLAIMER}`
        : "赞助模型没有返回文字，已保存结构化事实报告。",
    }
  } catch (error) {
    await recordUsage({
      requestId: `rwa_err_${randomUUID()}`,
      modelId: model.modelId,
      providerId: model.providerId,
      source: "rwa-research",
      walletAddress: input.subject,
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
      note: `赞助模型整理失败（${publicError(error)}）。结构化事实报告已保存。`,
    }
  }
}
