import { cookies } from "next/headers"
import {
  verifySiweAndCreateSession,
  walletAuthCookieOptions,
  WALLET_SESSION_COOKIE,
  WalletAuthError,
} from "@/lib/neon/wallet-auth"
import { bindWalletToUser } from "@/lib/neon/identity"
import { getCurrentUser } from "@/lib/neon/session"

export const dynamic = "force-dynamic"

/**
 * SIWE 验签 + 建立会话（httpOnly Cookie）。
 *
 * 若当前浏览器已有 Web2（Neon Auth）会话，验签成功后把该钱包**绑到当前账号**——
 * 这就是「先用 Google 登录，再连 MetaMask，还是同一个人、同一份权益」的实现点。
 * 绑定只在签名这一刻发生：光连接钱包不算（连钱包 ≠ 登录）。
 */
export async function POST(req: Request) {
  let body: { message?: unknown; signature?: unknown; intent?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: { code: "INVALID_JSON", message: "请求体不是合法 JSON" } }, { status: 400 })
  }

  if (typeof body.message !== "string" || typeof body.signature !== "string") {
    return Response.json(
      { error: { code: "INVALID_BODY", message: "需要 message 与 signature 字符串" } },
      { status: 400 },
    )
  }

  // intent=bind：账户页的「绑定钱包」，必须已登入且明确绑到当前账号
  const isBindIntent = body.intent === "bind"

  try {
    // 先读当前身份，再建钱包会话：此时新 cookie 还没写，读到的一定是登录态那一刻的状态
    const currentUser = await getCurrentUser().catch(() => null)

    if (isBindIntent && !currentUser?.userId) {
      return Response.json(
        { error: { code: "AUTH_REQUIRED", message: "请先登入再绑定钱包" } },
        { status: 401 },
      )
    }

    const session = await verifySiweAndCreateSession(body.message, body.signature)
    const cookieStore = await cookies()
    cookieStore.set(WALLET_SESSION_COOKIE, session.token, walletAuthCookieOptions)

    let linked = false
    let conflict = false
    // Web2 登录后再连钱包 → 视为「把这个钱包加进本账号」；
    // 纯钱包账号则只有用户明确点「绑定」才挂到当前 users.id（否则连着钱包 B 就是要换号）。
    const shouldBind = isBindIntent || currentUser?.source === "web2"
    if (shouldBind && currentUser?.userId) {
      const bound = await bindWalletToUser(session.address, currentUser.userId).catch(() => null)
      linked = Boolean(bound && bound.userId === currentUser.userId && !bound.conflict)
      conflict = Boolean(bound?.conflict)
    }

    // 显式绑定撞到「地址已属他人」时不能静默成功——用户点的是「绑定」，不是「切换账号」
    if (isBindIntent && conflict) {
      return Response.json(
        {
          error: {
            code: "WALLET_ALREADY_BOUND",
            message: "这个钱包已经绑定在另一个账号上，无法重复绑定。",
          },
        },
        { status: 409 },
      )
    }

    return Response.json({
      address: session.address,
      chainId: session.chainId,
      expiresAt: session.expiresAt.toISOString(),
      linked,
      conflict,
    })
  } catch (error) {
    if (error instanceof WalletAuthError) {
      // 503：验签依赖的上游 RPC 不可用 / 该链暂不支持智能账户验签。
      // 这是环境问题，不能回 401 让用户以为签名错了、反复重试签名。
      if (error.code === "SIGNATURE_VERIFY_UNAVAILABLE") {
        return Response.json(
          { error: { code: error.code, message: error.message } },
          { status: 503, headers: { "Retry-After": "5" } },
        )
      }
      const status =
        error.code === "INVALID_SIGNATURE" ||
        error.code === "INVALID_MESSAGE" ||
        error.code === "MESSAGE_EXPIRED" ||
        error.code === "MESSAGE_NOT_YET_VALID"
          ? 401
          : 400
      return Response.json({ error: { code: error.code, message: error.message } }, { status })
    }
    return Response.json(
      { error: { code: "INTERNAL", message: "登录失败，请稍后重试" } },
      { status: 500 },
    )
  }
}
