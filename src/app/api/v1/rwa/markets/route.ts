import { getTickerBoard } from "@/lib/rwa/markets"
import { isTickerCategory } from "@/lib/rwa/types"

/**
 * GET /api/v1/rwa/markets —— 代币化股票 / ETF / 大宗商品行情板（公开只读，无需鉴权）。
 *
 * 查询参数：
 *   category  stocks（默认）| etfs | commodities；省略时返回全部三类。
 *
 * 数据来源：CoinGecko 公开接口（/coins/markets 按 category），服务端缓存 10 分钟。
 * 口径提示：这些代币追踪标的资产价格，但并非股票或商品本身。
 */

/** 与行情缓存同源（进程内 10 分钟） */
export const revalidate = 600

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const category = params.get("category")
  const { board, fetchedAt, stale, error } = await getTickerBoard()

  if (category) {
    if (!isTickerCategory(category)) {
      return Response.json(
        { error: "INVALID_CATEGORY", valid: ["stocks", "etfs", "commodities"] },
        { status: 400 },
      )
    }
    return Response.json({
      source: "coingecko",
      fetchedAt,
      stale,
      ...(error ? { error } : {}),
      category,
      tickers: board[category],
    })
  }

  return Response.json({ source: "coingecko", fetchedAt, stale, ...(error ? { error } : {}), board })
}
