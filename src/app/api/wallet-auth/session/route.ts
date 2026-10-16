import { cookies } from "next/headers"
import { getSessionByToken, WALLET_SESSION_COOKIE } from "@/lib/neon/wallet-auth"
import { resolveSubject } from "@/lib/neon/identity"
import { readPlan } from "@/lib/neon/quota"
import { SPONSORED_DAILY_REQUESTS, SPONSORED_DAILY_TOKENS } from "@/lib/compute/plans"

export const dynamic = "force-dynamic"

/**
 * 读取当前钱包会话；未登录返回 { address: null }。
 * 已登录时附带当前档位（仅供 UI 展示）。
 *
 * 注意两点：
 * 1. 真正的档位判定一律在服务端业务路由里重新读取，不信任客户端传入的 plan。
 * 2. **不再回传档位相关的 token 额度**——赞助额度是全局常量、与档位无关
 *    （付费档位按 token 区分即构成变相转售，见 plans.ts 文件头红线 1）。
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
        dailyTokens: SPONSORED_DAILY_TOKENS,
        dailyRequests: SPONSORED_DAILY_REQUESTS,
      },
    })
  } catch {
    return Response.json({ address: null })
  }
}
