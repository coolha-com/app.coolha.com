import { createNonce, WalletAuthError } from "@/lib/neon/wallet-auth"

export const dynamic = "force-dynamic"

/** 签发 SIWE 登录 nonce。domain 默认取请求 Host（Vercel 下为 x-forwarded-host）。 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const address = url.searchParams.get("address") ?? ""
  const domain =
    url.searchParams.get("domain") ||
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    ""

  try {
    const result = await createNonce(address, domain)
    return Response.json({
      nonce: result.nonce,
      domain: result.domain,
      expiresAt: result.expiresAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof WalletAuthError) {
      return Response.json({ error: { code: error.code, message: error.message } }, { status: 400 })
    }
    return Response.json(
      { error: { code: "INTERNAL", message: "nonce 签发失败" } },
      { status: 500 },
    )
  }
}
