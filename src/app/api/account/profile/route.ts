import { updateUserProfile } from "@/lib/neon/account"
import { getCurrentUser } from "@/lib/neon/session"

export const dynamic = "force-dynamic"

/**
 * 更新当前用户的展示资料（名称 / 头像 URL）。
 *
 * 只写业务库 `users` 表 —— 侧边栏、账户页都从这里读，
 * Neon Auth 那边的 name/image 只在新用户首次登录时作为初始值。
 */
export async function PATCH(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json(
      { error: { code: "AUTH_REQUIRED", message: "请先登入" } },
      { status: 401 },
    )
  }
  if (!user.userId) {
    return Response.json(
      { error: { code: "IDENTITY_UNAVAILABLE", message: "身份服务暂不可用，请稍后重试" } },
      { status: 503 },
    )
  }

  let body: { displayName?: unknown; avatarUrl?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "请求体不是合法 JSON" } },
      { status: 400 },
    )
  }

  const displayName = typeof body.displayName === "string" ? body.displayName : null
  const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl : null

  if (displayName && displayName.trim().length > 40) {
    return Response.json(
      { error: { code: "NAME_TOO_LONG", message: "名称最多 40 个字符" } },
      { status: 400 },
    )
  }
  if (avatarUrl && avatarUrl.length > 500) {
    return Response.json(
      { error: { code: "URL_TOO_LONG", message: "头像链接过长" } },
      { status: 400 },
    )
  }
  if (avatarUrl && !/^https?:\/\//i.test(avatarUrl) && !avatarUrl.startsWith("/")) {
    return Response.json(
      { error: { code: "INVALID_URL", message: "头像需要是 http(s) 链接或站内路径" } },
      { status: 400 },
    )
  }

  const ok = await updateUserProfile(user.userId, { displayName, avatarUrl })
  if (!ok) {
    return Response.json(
      { error: { code: "UPDATE_FAILED", message: "保存失败，请稍后重试" } },
      { status: 500 },
    )
  }

  return Response.json({ ok: true })
}
