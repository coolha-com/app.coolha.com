import { jsonError, requireRwaSubject } from "@/lib/agents/http"
import { createAgentApiKey, listAgentApiKeys } from "@/lib/agents/api-keys"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response
  const keys = await listAgentApiKeys(auth.subject)
  return Response.json({ keys })
}

export async function POST(req: Request) {
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response
  let body: { label?: unknown }
  try {
    body = await req.json()
  } catch {
    return jsonError(400, "INVALID_JSON", "请求体不是合法 JSON")
  }
  const label = typeof body.label === "string" ? body.label : ""
  try {
    const created = await createAgentApiKey(auth.subject, label)
    return Response.json({
      key: created.record,
      secret: created.secret,
      notice: "这是唯一一次显示完整 API Key。请立刻复制。服务端只保存哈希。",
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : ""
    if (code === "INVALID_LABEL") return jsonError(400, "INVALID_LABEL", "名称需为 1–40 个字符，且不能包含密钥")
    if (code === "KEY_LIMIT") return jsonError(400, "KEY_LIMIT", "每个账户最多 5 个未撤销的 API Key")
    console.error("[agent-keys] 创建失败:", error instanceof Error ? error.name : "error")
    return jsonError(500, "KEY_CREATE_FAILED", "创建 API Key 失败")
  }
}
