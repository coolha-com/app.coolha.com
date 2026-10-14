import { NextResponse } from "next/server"
import { CATALOG_REVALIDATE_SECONDS, getModelCatalog } from "@/lib/ai-gateway/client"
import { filterModels } from "@/lib/compute/service"
import type { ComputeCapability, ComputeModelType, ModelSort } from "@/lib/compute/types"

/**
 * GET /api/v1/models —— 公开只读模型目录接口。
 *
 * 数据源：Vercel AI Gateway（GET {AI_GATEWAY_BASE_URL}/models），服务端持有密钥，
 * 默认缓存 1 小时。上游不可用时返回演示目录并在 source/stale 字段中标注，绝不伪造。
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
 *   refresh     设为 1 可跳过缓存回源；须同时传入与 CATALOG_REFRESH_TOKEN 一致的 token
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

  // 回源（跳过缓存）需要令牌，避免匿名流量打穿上游
  const refreshToken = process.env.CATALOG_REFRESH_TOKEN
  const wantsRefresh = params.get("refresh") === "1"
  const force =
    wantsRefresh && Boolean(refreshToken) && params.get("token") === refreshToken

  const catalog = await getModelCatalog({ force })

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
