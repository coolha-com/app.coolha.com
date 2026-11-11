import "server-only"

import type { ComputeCapability, ComputeModel, ComputeModelType } from "@/lib/compute/types"
import {
  INFERENCE_GATEWAY_NAME,
  inferenceContextWindow,
  inferenceModelIds,
} from "@/lib/inference/config"

/**
 * OpenRouter 公开模型目录（GET /api/v1/models）。
 * 不需要密钥。只把 INFERENCE_MODELS 白名单里的模型交给前端。
 * 目录失败时仍返回已配置的模型 ID，价格和规格标成未提供，不回退到演示目录。
 */

const MODELS_URL = "https://openrouter.ai/api/v1/models"
const SUCCESS_TTL_MS = 10 * 60 * 1000
const FAILURE_TTL_MS = 60 * 1000

export interface OpenRouterPricing {
  prompt: number
  completion: number
  cacheRead: number
}

export interface OpenRouterModelMeta {
  id: string
  name: string
  description: string
  contextLength: number | null
  maxOutputTokens: number | null
  pricing: OpenRouterPricing | null
  inputModalities: string[]
  supportedParameters: string[]
}

interface CatalogCache {
  at: number
  ok: boolean
  byId: Map<string, OpenRouterModelMeta>
  error: string | null
}

let cache: CatalogCache | null = null

function num(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.length > 0)
}

function parseModel(raw: unknown): OpenRouterModelMeta | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  if (typeof row.id !== "string" || !row.id) return null
  const architecture =
    row.architecture && typeof row.architecture === "object"
      ? (row.architecture as Record<string, unknown>)
      : null
  const top =
    row.top_provider && typeof row.top_provider === "object"
      ? (row.top_provider as Record<string, unknown>)
      : null
  const pricingRaw =
    row.pricing && typeof row.pricing === "object"
      ? (row.pricing as Record<string, unknown>)
      : null
  const prompt = pricingRaw ? num(pricingRaw.prompt) : null
  const completion = pricingRaw ? num(pricingRaw.completion) : null
  const cacheRead = pricingRaw ? num(pricingRaw.input_cache_read) : null
  const pricing =
    prompt !== null && completion !== null
      ? {
          prompt,
          completion,
          cacheRead: cacheRead ?? prompt,
        }
      : null
  const context = num(row.context_length) ?? (top ? num(top.context_length) : null)
  return {
    id: row.id,
    name: typeof row.name === "string" && row.name ? row.name : row.id,
    description: typeof row.description === "string" ? row.description.trim() : "",
    contextLength: context !== null && context > 0 ? context : null,
    maxOutputTokens: top ? num(top.max_completion_tokens) : null,
    pricing,
    inputModalities: architecture ? asStringList(architecture.input_modalities) : [],
    supportedParameters: asStringList(row.supported_parameters),
  }
}

export async function loadOpenRouterCatalog(force = false): Promise<CatalogCache> {
  const now = Date.now()
  if (!force && cache) {
    const ttl = cache.ok ? SUCCESS_TTL_MS : FAILURE_TTL_MS
    if (now - cache.at < ttl) return cache
  }

  try {
    const response = await fetch(MODELS_URL, { cache: "no-store" })
    if (!response.ok) {
      const failure: CatalogCache = {
        at: now,
        ok: false,
        byId: cache?.byId ?? new Map(),
        error: `HTTP_${response.status}`,
      }
      cache = failure
      return failure
    }
    const body = (await response.json()) as { data?: unknown[] }
    const byId = new Map<string, OpenRouterModelMeta>()
    for (const item of body.data ?? []) {
      const model = parseModel(item)
      if (model) byId.set(model.id, model)
    }
    const success: CatalogCache = { at: now, ok: true, byId, error: null }
    cache = success
    return success
  } catch {
    const failure: CatalogCache = {
      at: now,
      ok: false,
      byId: cache?.byId ?? new Map(),
      error: "NETWORK",
    }
    cache = failure
    return failure
  }
}

/** 测试用：清掉进程内缓存 */
export function resetOpenRouterCatalogCache(): void {
  cache = null
}

function toSlug(modelId: string): string {
  return modelId.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase()
}

function providerOf(modelId: string): { id: string; name: string } {
  const slug = modelId.split("/")[0] || "openrouter"
  return {
    id: slug.toLowerCase(),
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
  }
}

function capabilitiesOf(meta: OpenRouterModelMeta | null): ComputeCapability[] {
  if (!meta) return []
  const params = new Set(meta.supportedParameters)
  const caps: ComputeCapability[] = []
  if (params.has("tools") || params.has("tool_choice")) {
    caps.push("tools", "function-calling")
  }
  if (params.has("response_format") || params.has("structured_outputs")) {
    caps.push("json-mode")
  }
  if (meta.inputModalities.includes("image")) caps.push("vision")
  return caps
}

function perMillion(perToken: number): number {
  const value = perToken * 1_000_000
  return Number.isFinite(value) ? value : 0
}

function modelType(meta: OpenRouterModelMeta | null): ComputeModelType {
  if (meta?.inputModalities.includes("image") && !meta.inputModalities.includes("text")) {
    return "vision"
  }
  return "chat"
}

function toComputeModel(
  modelId: string,
  meta: OpenRouterModelMeta | null,
  fetchedAt: string,
): ComputeModel {
  const provider = providerOf(meta?.id ?? modelId)
  const priced = Boolean(meta?.pricing)
  const configuredContext = inferenceContextWindow()
  const contextLength = meta?.contextLength ?? configuredContext ?? 0
  const contextFromEnv = !meta?.contextLength && configuredContext !== null
  const summary = meta?.description
    ? meta.description
    : meta
      ? "OpenRouter 未提供简介。"
      : "OpenRouter 目录暂不可用。模型 ID 仍在服务端白名单内；价格与规格未提供。"
  const tags = [
    ...(priced ? ["priced"] : []),
    ...(meta ? [] : ["metadata-missing"]),
    ...(contextFromEnv ? ["context-from-env"] : []),
  ]
  return {
    id: toSlug(modelId),
    name: meta?.name ?? modelId,
    modelId,
    gatewayModelId: modelId,
    providerId: provider.id,
    providerName: meta ? provider.name : INFERENCE_GATEWAY_NAME,
    type: modelType(meta),
    summary: contextFromEnv
      ? `${summary} 上下文长度来自 INFERENCE_CONTEXT_WINDOW。`
      : summary,
    capabilities: capabilitiesOf(meta),
    contextLength,
    maxOutputTokens: meta?.maxOutputTokens && meta.maxOutputTokens > 0 ? meta.maxOutputTokens : 0,
    inputPricePerMillionUsd: priced && meta?.pricing ? perMillion(meta.pricing.prompt) : 0,
    outputPricePerMillionUsd: priced && meta?.pricing ? perMillion(meta.pricing.completion) : 0,
    cachedInputPricePerMillionUsd:
      priced && meta?.pricing ? perMillion(meta.pricing.cacheRead) : null,
    latencyMs: null,
    status: meta ? "online" : "unknown",
    dataSource: meta ? "provider-reported" : "mock",
    updatedAt: fetchedAt,
    tags,
    gatewayType: "language",
    providerSlug: provider.id,
    supportedParameters: meta?.supportedParameters,
    modalities: meta
      ? { input: meta.inputModalities, output: ["text"] }
      : undefined,
  }
}

export interface WhitelistCatalog {
  models: ComputeModel[]
  stale: boolean
  error?: string
  fetchedAt: string
}

/** 白名单 ∩ OpenRouter 目录。目录失败时仍返回白名单 ID。 */
export async function getWhitelistedModels(force = false): Promise<WhitelistCatalog> {
  const ids = inferenceModelIds()
  const fetchedAt = new Date().toISOString()
  if (ids.length === 0) {
    return {
      models: [],
      stale: true,
      error: "INFERENCE_NOT_CONFIGURED",
      fetchedAt,
    }
  }
  const catalog = await loadOpenRouterCatalog(force)
  const models = ids.map((id) => toComputeModel(id, catalog.byId.get(id) ?? null, fetchedAt))
  return {
    models,
    stale: !catalog.ok,
    error: catalog.ok ? undefined : (catalog.error ?? "CATALOG_UNAVAILABLE"),
    fetchedAt,
  }
}

export async function lookupOpenRouterPricing(modelId: string): Promise<OpenRouterPricing | null> {
  const catalog = await loadOpenRouterCatalog()
  const candidates = [modelId.trim()]
  const slash = modelId.indexOf("/")
  if (slash > 0 && slash < modelId.length - 1) candidates.push(modelId.slice(slash + 1))
  for (const id of candidates) {
    const pricing = catalog.byId.get(id)?.pricing
    if (pricing) return pricing
  }
  return null
}
