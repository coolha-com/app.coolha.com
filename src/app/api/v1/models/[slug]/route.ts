import { NextResponse } from "next/server"
import { CATALOG_REVALIDATE_SECONDS, getCatalogModelBySlug } from "@/lib/ai-gateway/client"
/**
 * GET /api/v1/models/[slug] —— 单个模型详情。
 * slug 由模型 ID 推导（如 anthropic/claude-sonnet-4.5 → anthropic-claude-sonnet-4-5）。
 */

export const runtime = "nodejs"
/** 段配置必须是字面量，值与 CATALOG_REVALIDATE_SECONDS 保持一致（3600） */
export const revalidate = 3600

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const model = await getCatalogModelBySlug(slug)

  if (!model) {
    return NextResponse.json(
      { error: { code: "MODEL_NOT_FOUND", message: `未找到模型：${slug}` } },
      { status: 404 },
    )
  }

  return NextResponse.json(
    { object: "model", data: model },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${CATALOG_REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
      },
    },
  )
}
