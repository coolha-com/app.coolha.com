import { unbindWallet } from "@/lib/neon/account"
import { getCurrentUser } from "@/lib/neon/session"

export const dynamic = "force-dynamic"

/**
 * 解绑当前账号下的一个钱包地址。
 *
 * 只允许解绑自己的；「唯一凭证」会被拒绝——否则账号再也登不进来，
 * 已经买过的服务权益就永久锁死在库里。
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params
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
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return Response.json(
      { error: { code: "INVALID_ADDRESS", message: "钱包地址格式不正确" } },
      { status: 400 },
    )
  }

  const result = await unbindWallet(user.userId, address)
  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : result.code === "LAST_CREDENTIAL" ? 409 : 500
    return Response.json({ error: { code: result.code, message: result.message } }, { status })
  }

  return Response.json({ ok: true })
}
