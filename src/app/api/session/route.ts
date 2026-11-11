import { getCurrentUser } from "@/lib/neon/session"

export const dynamic = "force-dynamic"

/**
 * 浏览器端读统一登录态（侧边栏头像、账户页刷新用）。
 *
 * 为什么不直接用 Neon Auth 客户端的 useSession()：那边的 name/image 是登录时快照，
 * 用户在 /account 改过资料后不会同步；纯钱包账号更是根本没有 Neon 用户。
 * 这里统一以服务端 getCurrentUser() 的口径为准。
 *
 * 只回传展示需要的字段，不回传 subject（客户端拿 user_id 没有任何用处）。
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json(
      { signedIn: false },
      { headers: { "Cache-Control": "no-store" } },
    )
  }

  return Response.json(
    {
      signedIn: true,
      source: user.source,
      name: user.name,
      email: user.email,
      image: user.image,
      address: user.address,
      label: user.name?.trim() || user.email?.trim() || user.address || "",
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
