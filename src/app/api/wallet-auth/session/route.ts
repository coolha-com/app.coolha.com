import { cookies } from "next/headers"
import { getSessionByToken, WALLET_SESSION_COOKIE } from "@/lib/neon/wallet-auth"
import { resolveSubject } from "@/lib/neon/identity"
import { readPlan } from "@/lib/neon/quota"

export const dynamic = "force-dynamic"

/**
 * 读取当前钱包会话；未登录返回 { address: null }。
 * 已登录时附带当前档位与每日额度上限（仅供 UI 展示）。
 * 注意：真正的档位判定一律在服务端业务路由里重新读取，不信任客户端传入的 plan。
 */
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(WALLET_SESSION_COOKIE)?.value ?? ""
  try {
    const session = await getSessionByToken(token)
    if (!session) {
      return Response.json({ address: null })
    }
    const plan = await readPlan(await resolveSubject(session.address))
    return Response.json({
      address: session.address,
      chainId: session.chainId,
      expiresAt: session.expiresAt.toISOString(),
      plan: {
        id: plan.id,
        name: plan.name,
        dailyTokens: plan.quota.dailyTokens,
        dailyRequests: plan.quota.dailyRequests,
      },
    })
  } catch {
    return Response.json({ address: null })
  }
}
