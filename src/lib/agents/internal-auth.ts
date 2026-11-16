import "server-only"

import { timingSafeEqual } from "node:crypto"

import { jsonError, rejectHardBlock } from "@/lib/agents/http"

const DEV_SECRET = "coolha-local-eve-proxy"

function localEve(): boolean {
  return process.env.COOLHA_EVE_LOCAL === "1" || process.env.NODE_ENV !== "production"
}

export function internalSecret(): string | null {
  return process.env.EVE_INTERNAL_SECRET ?? (localEve() ? DEV_SECRET : null)
}

function sameSecret(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length || a.length === 0) return false
  return timingSafeEqual(a, b)
}

/** MCP 只认内部共享密钥。用户 API Key 与页面登录都不能代替它。 */
export function requireInternalAuth(
  req: Request,
): { ok: true } | { ok: false; response: Response } {
  const blocked = rejectHardBlock(req)
  if (blocked) return { ok: false, response: blocked }

  const expected = internalSecret()
  if (!expected) {
    return {
      ok: false,
      response: jsonError(503, "INTERNAL_AUTH_NOT_CONFIGURED", "内部凭证未配置，MCP 不开放"),
    }
  }
  const provided = req.headers.get("x-coolha-eve-secret") ?? ""
  if (!sameSecret(provided, expected)) {
    return {
      ok: false,
      response: jsonError(401, "INTERNAL_AUTH_REQUIRED", "MCP 只接受内部凭证，普通用户 API Key 未启用"),
    }
  }
  return { ok: true }
}
