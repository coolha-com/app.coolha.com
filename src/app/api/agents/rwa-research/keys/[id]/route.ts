import { jsonError, requireRwaSubject } from "@/lib/agents/http"
import { revokeAgentApiKey } from "@/lib/agents/api-keys"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireRwaSubject()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  if (!ID_RE.test(id)) return jsonError(400, "INVALID_ID", "Key 编号不正确")
  const revoked = await revokeAgentApiKey(auth.subject, id)
  if (!revoked) return jsonError(404, "NOT_FOUND", "没有可撤销的 Key")
  return Response.json({ revoked: true })
}
