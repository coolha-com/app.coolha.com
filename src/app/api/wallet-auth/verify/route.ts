import { cookies } from "next/headers"
import {
  verifySiweAndCreateSession,
  walletAuthCookieOptions,
  WALLET_SESSION_COOKIE,
  WalletAuthError,
} from "@/lib/neon/wallet-auth"

export const dynamic = "force-dynamic"

/** SIWE 验签 + 建立会话（httpOnly Cookie） */
export async function POST(req: Request) {
  let body: { message?: unknown; signature?: unknown }
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

  try {
    const session = await verifySiweAndCreateSession(body.message, body.signature)
    const cookieStore = await cookies()
    cookieStore.set(WALLET_SESSION_COOKIE, session.token, walletAuthCookieOptions)
    return Response.json({
      address: session.address,
      chainId: session.chainId,
      expiresAt: session.expiresAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof WalletAuthError) {
      const status = error.code === "INVALID_SIGNATURE" || error.code === "INVALID_MESSAGE" ? 401 : 400
      return Response.json({ error: { code: error.code, message: error.message } }, { status })
    }
    return Response.json(
      { error: { code: "INTERNAL", message: "登录失败，请稍后重试" } },
      { status: 500 },
    )
  }
}
