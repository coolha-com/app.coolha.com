import { cookies } from "next/headers"
import { getSessionByToken, WALLET_SESSION_COOKIE } from "@/lib/neon/wallet-auth"

export const dynamic = "force-dynamic"

/** 读取当前钱包会话；未登录返回 { address: null } */
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(WALLET_SESSION_COOKIE)?.value ?? ""
  try {
    const session = await getSessionByToken(token)
    if (!session) {
      return Response.json({ address: null })
    }
    return Response.json({
      address: session.address,
      chainId: session.chainId,
      expiresAt: session.expiresAt.toISOString(),
    })
  } catch {
    return Response.json({ address: null })
  }
}
