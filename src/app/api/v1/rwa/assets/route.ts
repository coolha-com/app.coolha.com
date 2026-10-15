import { getRwaSnapshot } from "@/lib/rwa/client"
import { filterRwaAssets, sortRwaAssets, toListAsset } from "@/lib/rwa/service"
import { isRwaSort } from "@/lib/rwa/types"

/**
 * GET /api/v1/rwa/assets —— RWA 代币化资产聚合目录（公开只读，无需鉴权）。
 *
 * 查询参数：
 *   q            关键词（协议名 / slug / 分类）
 *   chain        链名精确过滤（Ethereum、Base、Solana…）
 *   minTvl       一级市场 TVL 下限（美元）
 *   onlyWithDex  仅返回有二级市场 DEX 池的资产（1 / true）
 *   sort         primary-desc（默认）| secondary-desc | secondary-share-desc | name-asc | change1d-desc
 *   limit        返回条数上限（默认 50，最大 200）
 *
 * 数据来源：DefiLlama 公开接口（协议快照 + 池子快照），服务端缓存 1 小时。
 */

/** 与快照同源的 1 小时缓存 */
export const revalidate = 3600

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams

  const sortParam = params.get("sort") ?? "primary-desc"
  const sort = isRwaSort(sortParam) ? sortParam : "primary-desc"
  const limitRaw = Number.parseInt(params.get("limit") ?? "50", 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50
  const minTvlRaw = Number.parseInt(params.get("minTvl") ?? "0", 10)
  const onlyWithDex = ["1", "true", "yes"].includes((params.get("onlyWithDex") ?? "").toLowerCase())

  const snapshot = await getRwaSnapshot()
  const filtered = filterRwaAssets(snapshot.assets, {
    q: params.get("q") ?? undefined,
    chain: params.get("chain") ?? undefined,
    minTvl: Number.isFinite(minTvlRaw) ? minTvlRaw : 0,
    onlyWithDex,
  })
  const sorted = sortRwaAssets(filtered, sort)
  const items = sorted.slice(0, limit).map(toListAsset)

  return Response.json({
    source: snapshot.source,
    fetchedAt: snapshot.fetchedAt,
    stale: snapshot.stale,
    ...(snapshot.error ? { error: snapshot.error } : {}),
    total: filtered.length,
    returned: items.length,
    sort,
    totals: snapshot.totals,
    assets: items,
  })
}
