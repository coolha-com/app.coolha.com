import { getCurrentUser } from "@/lib/neon/session"
import {
  SubscriptionError,
  createSubscriptionOrder,
  listLedger,
  listSubscriptionOrders,
} from "@/lib/neon/subscription"
import {
  SUBSCRIPTION_CHAINS,
  isChainKey,
  isTokenSymbol,
} from "@/lib/subscription/config"
import { isPlanId, PLANS } from "@/lib/compute/plans"
import { readPlan } from "@/lib/neon/quota"

export const dynamic = "force-dynamic"

/** 创建链上订阅订单（需登录；链上支付必须有钱包地址） */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json(
      { error: { code: "AUTH_REQUIRED", message: "请先登入" } },
      { status: 401 },
    )
  }
  // 链上付款要用钱包签名发起交易；纯 Web2 账号没有地址，必须先用钱包登录
  if (!user.address) {
    return Response.json(
      { error: { code: "WALLET_REQUIRED", message: "链上支付需要先用钱包登录" } },
      { status: 400 },
    )
  }
  const walletAddress = user.address

  let body: { plan?: unknown; chain?: unknown; token?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json(
      { error: { code: "INVALID_JSON", message: "请求体不是合法 JSON" } },
      { status: 400 },
    )
  }

  if (!isPlanId(body.plan) || PLANS[body.plan].priceUsd <= 0) {
    return Response.json(
      { error: { code: "INVALID_PLAN", message: "档位不存在或无需付费" } },
      { status: 400 },
    )
  }
  if (!isChainKey(body.chain) || !isTokenSymbol(body.token)) {
    return Response.json(
      { error: { code: "INVALID_PAYMENT_OPTION", message: "不支持的支付网络或币种" } },
      { status: 400 },
    )
  }

  const chainConfig = SUBSCRIPTION_CHAINS[body.chain]
  const tokenConfig = chainConfig.tokens[body.token]

  try {
    const subject = user.subject
    const order = await createSubscriptionOrder({
      subject,
      walletAddress,
      plan: body.plan,
      chain: body.chain,
      token: body.token,
      tokenAddress: tokenConfig.address,
      decimals: tokenConfig.decimals,
      geo_tier: req.headers.get("x-coolha-geo-access-tier"),
    })
    return Response.json({ order })
  } catch (error) {
    if (error instanceof SubscriptionError) {
      const status = error.code === "REGION_BLOCKED" ? 451 : 400
      return Response.json({ error: { code: error.code, message: error.message } }, { status })
    }
    console.error("[subscription] 创建订单失败:", error)
    return Response.json(
      { error: { code: "ORDER_FAILED", message: "创建订单失败，请稍后重试" } },
      { status: 500 },
    )
  }
}

/** 我的订阅状态：当前档位 + 订单 + 账本流水 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) {
    return Response.json({ signedIn: false, plan: "free", orders: [], ledger: [] })
  }
  const subject = user.subject
  const [plan, orders, ledger] = await Promise.all([
    readPlan(subject),
    listSubscriptionOrders(subject),
    listLedger(subject),
  ])
  return Response.json({
    signedIn: true,
    plan: plan.id,
    planName: plan.name,
    periodEnd: null,
    orders,
    ledger,
  })
}
