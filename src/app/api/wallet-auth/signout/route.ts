import { cookies } from "next/headers"
import { revokeSession, WALLET_SESSION_COOKIE } from "@/lib/neon/wallet-auth"

export const dynamic = "force-dynamic"

/** 退出登录：撤销服务端会话并清除 Cookie */
export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get(WALLET_SESSION_COOKIE)?.value ?? ""
  try {
    await revokeSession(token)
  } catch {
    // 撤销失败也继续清除 Cookie，保证客户端登出
  }
  cookieStore.delete(WALLET_SESSION_COOKIE)
  return Response.json({ ok: true })
}
