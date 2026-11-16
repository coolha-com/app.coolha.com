import { rejectHardBlock } from "@/lib/agents/http"
import { CHAIN_REGISTRY } from "@/lib/chains/registry"
import { getCurrentUser } from "@/lib/neon/session"
import { runRwaResearch } from "@/lib/rwa/research"
import { STRUCTURAL_GAPS } from "@/lib/rwa/sections"
import { isAddress } from "@/lib/rwa/abi"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const hits = new Map<string, number[]>()

function allow(key: string): boolean {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((at) => now - at < 60_000)
  if (recent.length >= 20) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}

function clientKey(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? ""
  return forwarded.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
}

/** 不发起 RPC。给页面展示接通与缺口。 */
export async function GET(req: Request) {
  const blocked = rejectHardBlock(req)
  if (blocked) return blocked
  return Response.json(
    {
      chains: CHAIN_REGISTRY.map((entry) => ({
        key: entry.key,
        label: entry.label,
        chainId: entry.chainId,
        access: entry.access,
        priority: entry.priority,
        batch: entry.batch,
      })),
      priorityMeaning: "priority 是接入顺序，不是投资排名。",
      structuralGaps: STRUCTURAL_GAPS,
      paymentStatus: "unpaid",
      checkout: "未接通",
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}

export async function POST(req: Request) {
  const blocked = rejectHardBlock(req)
  if (blocked) return blocked
  if (!allow(clientKey(req))) {
    return Response.json(
      { status: "rate_limited", message: "请求过于频繁，请稍后再试。" },
      { status: 429 },
    )
  }

  let body: { chain?: unknown; address?: unknown; holder?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ status: "invalid_request", message: "请求体不是合法 JSON" }, { status: 400 })
  }

  const chain = typeof body.chain === "string" ? body.chain : ""
  const address = typeof body.address === "string" ? body.address.trim() : ""
  const holder = typeof body.holder === "string" && body.holder.trim() ? body.holder.trim() : null
  if (!isAddress(address) || (holder && !isAddress(holder))) {
    return Response.json(
      { status: "invalid_request", message: "address 与 holder 必须是 0x 地址" },
      { status: 400 },
    )
  }

  const user = await getCurrentUser().catch(() => null)
  const result = await runRwaResearch({
    chainKey: chain,
    address,
    holder,
    subject: user?.subject ?? null,
  })
  const status =
    result.status === "not_configured"
      ? 503
      : result.status === "not_connected" || result.status === "invalid_request"
        ? 400
        : result.status === "upstream_error"
          ? 502
          : 200
  return Response.json(result, { status, headers: { "Cache-Control": "no-store" } })
}
