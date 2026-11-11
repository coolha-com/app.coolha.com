import { NextResponse } from "next/server"
import { CATALOG_REVALIDATE_SECONDS, getModelCatalog } from "@/lib/ai-gateway/client"
import { filterModels } from "@/lib/compute/service"
import type { ComputeCapability, ComputeModelType, ModelSort } from "@/lib/compute/types"

/**
 * GET /api/v1/models —— 公开只读模型目录接口。
 *
 * 数据源：推理网关未接入前固定返回 Phase 1 示例布局目录，并在 source/stale/error
 * 字段中明确标注 INFERENCE_NOT_CONFIGURED，绝不把示例数据伪装成真实目录。
 * 接入带 /v1/models 目录接口的网关后替换 src/lib/ai-gateway/client.ts 即可。
 *
 * 查询参数：
 *   q           关键词（名称 / 模型 ID / 供应商 / 简介）
 *   provider    供应商 ID，如 anthropic
 *   type        模型类型：chat / embedding / image / video / audio / reranking / realtime / evaluation
 *   capability  能力：streaming / vision / tools / json-mode / function-calling
 *   maxPrice    输入价格上限（USD / 百万 tokens）
 *   sort        name-asc / price-asc / price-desc / output-price-asc / output-price-desc /
 *               latency-asc / context-desc / context-asc
 *   limit       返回条数上限（默认 100，最大 500）
 *   offset      偏移量（默认 0）
 *   refresh     保留以兼容旧客户端；当前无上游可刷新，不产生回源
 *   token       回源鉴权令牌
 */

export const runtime = "nodejs"
/** 段配置必须是字面量，值与 CATALOG_REVALIDATE_SECONDS 保持一致（3600） */
export const revalidate = 3600

const VALID_SORTS: ModelSort[] = [
  "name-asc",
  "price-asc",
  "price-desc",
  "output-price-asc",
  "output-price-desc",
  "latency-asc",
  "context-desc",
  "context-asc",
]

function parseLimit(value: string | null): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 100
  return Math.min(Math.floor(parsed), 500)
}

function parseOffset(value: string | null): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.floor(parsed)
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams

  // 当前无上游可刷新：refresh 参数仅保留兼容，不产生回源
  const catalog = await getModelCatalog()

  const sortRaw = params.get("sort") as ModelSort | null
  const sort: ModelSort = sortRaw && VALID_SORTS.includes(sortRaw) ? sortRaw : "name-asc"
  const maxPriceRaw = params.get("maxPrice")
  const maxPrice = maxPriceRaw !== null && Number.isFinite(Number(maxPriceRaw)) ? Number(maxPriceRaw) : null

  const filtered = filterModels(catalog.models, {
    search: params.get("q") ?? undefined,
    type: (params.get("type") as ComputeModelType | null) ?? "all",
    providerId: params.get("provider") ?? "all",
    capability: (params.get("capability") as ComputeCapability | null) ?? "all",
    maxInputPricePerMillion: maxPrice,
    sort,
  })

  const offset = parseOffset(params.get("offset"))
  const limit = parseLimit(params.get("limit"))
  const data = filtered.slice(offset, offset + limit)

  return NextResponse.json(
    {
      object: "list",
      source: catalog.source,
      stale: catalog.stale,
      fetchedAt: catalog.fetchedAt,
      error: catalog.error ?? null,
      total: filtered.length,
      count: data.length,
      offset,
      limit,
      providers: catalog.providers,
      data,
    },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${CATALOG_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
      },
    },
  )
}
