import "server-only"

import { recordUsage } from "@/lib/neon/ai-usage"
import { authenticateAgentApiKey } from "@/lib/agents/api-keys"
import { jsonError, rejectHardBlock } from "@/lib/agents/http"

const hits = new Map<string, number[]>()

function allow(keyId: string): boolean {
  const now = Date.now()
  const recent = (hits.get(keyId) ?? []).filter((at) => now - at < 60_000)
  if (recent.length >= 20) {
    hits.set(keyId, recent)
    return false
  }
  recent.push(now)
  hits.set(keyId, recent)
  return true
}

/**
 * 外部调用只认 Bearer API Key。页面登录 Cookie 不能代替 Key。
 */
export async function requireAgentApiKey(
  req: Request,
): Promise<{ ok: true; subject: string; keyId: string } | { ok: false; response: Response }> {
  const blocked = rejectHardBlock(req)
  if (blocked) return { ok: false, response: blocked }

  const header = req.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : ""
  if (!token) {
    return {
      ok: false,
      response: jsonError(401, "API_KEY_REQUIRED", "请使用 Authorization: Bearer ck_…，页面登录不能代替 API Key"),
    }
  }

  const auth = await authenticateAgentApiKey(token)
  if (!auth) {
    return { ok: false, response: jsonError(401, "API_KEY_INVALID", "API Key 无效或已撤销") }
  }
  if (!allow(auth.keyId)) {
    return { ok: false, response: jsonError(429, "RATE_LIMITED", "这个 Key 的调用过于频繁，请稍后再试") }
  }
  return { ok: true, subject: auth.subject, keyId: auth.keyId }
}

export async function recordAgentCall(input: {
  subject: string
  source: "rwa-api" | "rwa-mcp"
  tool: string
  status: "success" | "error"
  latencyMs: number
  errorCode?: string
}): Promise<void> {
  await recordUsage({
    requestId: `${input.source}_${crypto.randomUUID()}`,
    modelId: input.tool,
    source: input.source,
    walletAddress: input.subject,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    latencyMs: input.latencyMs,
    status: input.status,
    errorCode: input.errorCode ?? null,
  }).catch(() => undefined)
}
