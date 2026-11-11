import { jsonError, rejectHardBlock, requireRwaSubject } from "@/lib/agents/http"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * 浏览器内 BYOK 整理通道已下线。
 *
 * 保留路由只为给出明确的 410，不再解析请求体、不再写库。
 * 报告的模型整理现在统一由平台模型在服务端生成。
 */
export async function POST(req: Request) {
  const blocked = rejectHardBlock(req)
  if (blocked) return blocked
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response
  return jsonError(410, "BYOK_RETIRED", "自带模型通道已下线，报告由平台模型生成")
}
