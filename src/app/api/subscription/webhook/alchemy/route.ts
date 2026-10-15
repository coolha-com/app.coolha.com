import { createHmac, timingSafeEqual } from "node:crypto"
import {
  SUBSCRIPTION_CHAINS,
  type ChainKey,
  type TokenSymbol,
} from "@/lib/subscription/config"
import { getTreasuryAddress, settleWithTransfer } from "@/lib/neon/subscription"

export const dynamic = "force-dynamic"

/**
 * Alchemy Address Activity Webhook。
 *
 * 定位：**可选加速通道**。真正的权威入账路径是 `/api/subscription/cron/sync`
 * （自建轮询，不依赖外部注册）。本端点仅在配置了 ALCHEMY_WEBHOOK_SIGNING_KEY 时启用，
 * 并用 HMAC-SHA256 校验签名；未配置直接 503，避免留下一个开放的授予入口。
 *
 * 幂等：同一 (tx_hash, log_index) 唯一索引 + settleWithTransfer 内部占位更新，
 * 与 cron 并发也只会授予一次。
 */

interface AlchemyActivity {
  category?: string
  fromAddress?: string
  toAddress?: string
  hash?: string
  logIndex?: number | string
  value?: number | string
  rawContract?: { address?: string; rawValue?: string; decimal?: string }
}

function verifySignature(raw: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = createHmac("sha256", secret).update(raw).digest("hex")
  const a = Buffer.from(expected, "utf8")
  const b = Buffer.from(signature, "utf8")
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function tokenByAddress(address: string): { chain: ChainKey; token: TokenSymbol } | null {
  const target = address.toLowerCase()
  for (const chain of Object.keys(SUBSCRIPTION_CHAINS) as ChainKey[]) {
    for (const token of Object.keys(SUBSCRIPTION_CHAINS[chain].tokens) as TokenSymbol[]) {
      if (SUBSCRIPTION_CHAINS[chain].tokens[token].address.toLowerCase() === target) {
        return { chain, token }
      }
    }
  }
  return null
}

function activityValue(activity: AlchemyActivity, decimals: number): bigint {
  const rawHex = activity.rawContract?.rawValue
  if (rawHex && /^0x[0-9a-fA-F]+$/.test(rawHex)) return BigInt(rawHex)
  const human = Number(activity.value ?? 0)
  if (!Number.isFinite(human) || human <= 0) return 0n
  // 退化路径：按小数位换算（可能有精度误差，仅作兜底）
  return BigInt(Math.round(human * 10 ** decimals))
}

export async function POST(req: Request) {
  const secret = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY ?? ""
  if (!secret) {
    return Response.json(
      { error: { code: "WEBHOOK_DISABLED", message: "未配置 ALCHEMY_WEBHOOK_SIGNING_KEY" } },
      { status: 503 },
    )
  }

  const raw = await req.text()
  if (!verifySignature(raw, req.headers.get("x-alchemy-signature"), secret)) {
    return Response.json({ error: { code: "BAD_SIGNATURE" } }, { status: 401 })
  }

  const treasury = getTreasuryAddress().toLowerCase()
  if (!treasury) {
    return Response.json({ error: { code: "TREASURY_NOT_CONFIGURED" } }, { status: 503 })
  }

  let payload: { event?: { network?: string; activity?: AlchemyActivity[] } }
  try {
    payload = JSON.parse(raw)
  } catch {
    return Response.json({ error: { code: "INVALID_JSON" } }, { status: 400 })
  }

  const activities = payload.event?.activity ?? []
  let granted = 0
  let seen = 0

  for (const activity of activities) {
    if (activity.category !== "erc20") continue
    if (!activity.toAddress || activity.toAddress.toLowerCase() !== treasury) continue
    const contract = activity.rawContract?.address ?? ""
    const matched = tokenByAddress(contract)
    if (!matched) continue
    const decimals = SUBSCRIPTION_CHAINS[matched.chain].tokens[matched.token].decimals
    const value = activityValue(activity, decimals)
    if (value <= 0n || !activity.fromAddress || !activity.hash) continue

    seen += 1
    const result = await settleWithTransfer({
      chain: matched.chain,
      token: matched.token,
      from: activity.fromAddress,
      raw: value,
      txHash: activity.hash,
      logIndex: Number(activity.logIndex ?? 0),
    })
    if (result.status === "granted") granted += 1
  }

  return Response.json({ ok: true, seen, granted })
}
