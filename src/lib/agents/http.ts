import "server-only"

import { getWalletSessionFromCookies } from "@/lib/neon/wallet-auth"
import { resolveSubject } from "@/lib/neon/identity"
import { isDatabaseConfigured } from "@/lib/neon/postgres"

export function jsonError(status: number, code: string, message: string) {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  )
}

export function rejectHardBlock(req: Request): Response | null {
  if (req.headers.get("x-coolha-geo-access-tier") === "hard-block") {
    return jsonError(451, "REGION_BLOCKED", "当前地区不支持该服务")
  }
  return null
}

export function readGeoTier(req: Request): string | null {
  const tier = req.headers.get("x-coolha-geo-access-tier")
  return tier && tier.length > 0 ? tier : null
}

export async function requireRwaSubject(): Promise<
  { ok: true; subject: string } | { ok: false; response: Response }
> {
  if (!isDatabaseConfigured()) {
    return { ok: false, response: jsonError(503, "DB_NOT_CONFIGURED", "数据库未配置") }
  }
  const session = await getWalletSessionFromCookies()
  if (!session?.address) {
    return {
      ok: false,
      response: jsonError(401, "AUTH_REQUIRED", "请先连接钱包并签名登录"),
    }
  }
  const subject = await resolveSubject(session.address)
  if (!subject) {
    return { ok: false, response: jsonError(401, "AUTH_REQUIRED", "无法确认当前用户") }
  }
  return { ok: true, subject }
}
