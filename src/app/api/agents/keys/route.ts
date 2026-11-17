import { jsonError, requireRwaSubject } from "@/lib/agents/http"
import { listAgentApiKeys } from "@/lib/agents/api-keys"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response
  const keys = await listAgentApiKeys(auth.subject)
  return Response.json({ keys })
}

export async function POST() {
  return jsonError(403, "USER_KEYS_DISABLED", "普通用户端未启用 API Key。签发代码仍保留，当前不创建凭证。")
}
