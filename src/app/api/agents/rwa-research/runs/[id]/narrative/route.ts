import { jsonError, rejectHardBlock, requireRwaSubject } from "@/lib/agents/http"
import { containsSecretValue, findSecretKey, RWA_COMMERCIAL } from "@/lib/agents/rwa-research"
import { attachBrowserNarrative } from "@/lib/neon/rwa-research"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ORDER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const blocked = rejectHardBlock(req)
  if (blocked) return blocked
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  if (!ORDER_ID_RE.test(id)) return jsonError(400, "INVALID_ID", "执行记录编号不正确")

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError(400, "INVALID_JSON", "请求体不是合法 JSON")
  }
  if (findSecretKey(body)) return jsonError(400, "SECRET_REJECTED", "不能上传密钥")
  const text = body && typeof body === "object" && "text" in body ? (body as { text?: unknown }).text : ""
  if (typeof text !== "string" || text.trim().length < 1 || text.trim().length > 8000) {
    return jsonError(400, "INVALID_NARRATIVE", "整理文本需在 1–8000 字符之间")
  }
  if (containsSecretValue(text)) return jsonError(400, "SECRET_REJECTED", "整理文本里不能包含密钥")

  try {
    const run = await attachBrowserNarrative({
      subject: auth.subject,
      orderId: id,
      narrative: text.trim(),
    })
    if (!run) {
      return jsonError(400, "NARRATIVE_REJECTED", "只有 BYOK 配置下已完成的执行记录可以附上浏览器整理")
    }
    return Response.json({ run, commercial: RWA_COMMERCIAL })
  } catch (error) {
    console.error("[rwa-research] 保存浏览器整理失败:", error instanceof Error ? error.name : "error")
    return jsonError(500, "NARRATIVE_FAILED", "保存整理文本失败")
  }
}
