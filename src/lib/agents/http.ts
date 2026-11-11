import "server-only"

import { getCurrentUser } from "@/lib/neon/session"
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
  const user = await getCurrentUser()
  if (!user) {
    return {
      ok: false,
      response: jsonError(401, "AUTH_REQUIRED", "请先登入后再使用该服务"),
    }
  }
  return { ok: true, subject: user.subject }
}
