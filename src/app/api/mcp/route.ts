import { requireInternalAuth } from "@/lib/agents/internal-auth"
import { connectedChains, CHAIN_REGISTRY } from "@/lib/chains/registry"
import { fetchChainSnapshot, isAlchemyConfigured, isToolChain } from "@/lib/web3-tools/alchemy"
import { runRwaResearch } from "@/lib/rwa/research"
import { STRUCTURAL_GAPS } from "@/lib/rwa/sections"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const SERVER_INFO = { name: "coolha-rwa-internal", version: "0.3.0" }

const MCP_DISCLAIMER =
  "内部只读。不签名、不转账、不兑换。没有取到的章节保持缺口。不构成审计意见或投资建议。付款状态不是已收款。"

function rpcResult(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result })
}

function rpcError(id: unknown, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } })
}

const CONNECTED = connectedChains().map((entry) => entry.key)

function tools() {
  return [
    {
      name: "rwa_list_chains",
      description: "返回 RWA 链登记。priority 是接入顺序。access=reserved 的链未接入，不能当作已读。",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
    {
      name: "rwa_read_token",
      description:
        "读取已接通链上的代币基础信息，并给出带缺口标记的研究报告。持有人分布、历史转账和 Top 集中度没有索引，不会编造。",
      inputSchema: {
        type: "object",
        properties: {
          chain: { type: "string", enum: CONNECTED },
          address: { type: "string" },
          holder: { type: "string", description: "可选。只计算这一个地址相对 totalSupply 的比例。" },
        },
        required: ["chain", "address"],
        additionalProperties: false,
      },
    },
    {
      name: "alchemy_read_chain",
      description: `最新区块，以及可选地址的原生币余额和交易数。只覆盖已接通的链：${CONNECTED.join("、")}。不是官方 MCP 端点。`,
      inputSchema: {
        type: "object",
        properties: {
          chain: { type: "string", enum: CONNECTED },
          address: { type: "string" },
        },
        required: ["chain"],
        additionalProperties: false,
      },
    },
  ]
}

export async function POST(req: Request) {
  const auth = requireInternalAuth(req)
  if (!auth.ok) return auth.response

  let body: { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown }
  try {
    body = await req.json()
  } catch {
    return rpcError(null, -32700, "请求体不是合法 JSON")
  }
  if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return rpcError(body.id, -32600, "不是 JSON-RPC 2.0 请求")
  }

  if (body.method === "initialize") {
    return rpcResult(body.id, {
      protocolVersion: "2025-03-26",
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions: MCP_DISCLAIMER,
    })
  }
  if (body.method === "notifications/initialized" || body.method === "initialized") {
    return new Response(null, { status: 202 })
  }
  if (body.method === "tools/list") {
    return rpcResult(body.id, { tools: tools() })
  }
  if (body.method === "tools/call") {
    return callTool(body.id, body.params)
  }
  return rpcError(body.id, -32601, "不支持的方法")
}

async function callTool(id: unknown, params: unknown) {
  const record = params && typeof params === "object" ? (params as { name?: unknown; arguments?: unknown }) : {}
  const name = typeof record.name === "string" ? record.name : ""
  const args =
    record.arguments && typeof record.arguments === "object"
      ? (record.arguments as Record<string, unknown>)
      : {}

  if (name === "rwa_list_chains") {
    return rpcResult(id, {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            priorityMeaning: "priority 是接入顺序，不是投资排名。",
            chains: CHAIN_REGISTRY.map((entry) => ({
              key: entry.key,
              label: entry.label,
              chainId: entry.chainId,
              access: entry.access,
              priority: entry.priority,
              batch: entry.batch,
            })),
            structuralGaps: STRUCTURAL_GAPS,
            checkout: "未接通",
            paymentStatus: "unpaid",
          }),
        },
      ],
      isError: false,
    })
  }

  if (name === "rwa_read_token") {
    const chain = typeof args.chain === "string" ? args.chain : ""
    const address = typeof args.address === "string" ? args.address : ""
    const holder = typeof args.holder === "string" ? args.holder : null
    const result = await runRwaResearch({ chainKey: chain, address, holder, subject: "internal" })
    return rpcResult(id, {
      content: [{ type: "text", text: JSON.stringify(result) }],
      isError: result.status !== "live",
    })
  }

  if (name === "alchemy_read_chain") {
    if (!isAlchemyConfigured()) {
      return rpcResult(id, {
        content: [{ type: "text", text: "服务端未配置 Alchemy，本次没有数据" }],
        isError: true,
      })
    }
    if (!isToolChain(args.chain)) {
      return rpcResult(id, {
        content: [{ type: "text", text: `chain 只能是已接通的 ${CONNECTED.join("、")}` }],
        isError: true,
      })
    }
    const address = typeof args.address === "string" ? args.address : null
    if (address && !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return rpcResult(id, { content: [{ type: "text", text: "address 必须是 0x 地址" }], isError: true })
    }
    const result = await fetchChainSnapshot({ chain: args.chain, address })
    return rpcResult(id, {
      content: [{ type: "text", text: JSON.stringify(result) }],
      isError: !result.ok,
    })
  }

  return rpcError(id, -32602, "没有这个内部工具")
}
