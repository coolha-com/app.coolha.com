import { recordAgentCall, requireAgentApiKey } from "@/lib/agents/api-auth"
import { listConnectedReadTools } from "@/lib/agents/agent-contracts"
import { fetchChainSnapshot, isAlchemyConfigured, isToolChain } from "@/lib/web3-tools/alchemy"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const SERVER_INFO = { name: "coolha", version: "0.2.0" }

/**
 * 只读。返回的是这次实际取到的链上事实，不做评级、不给结论性判断。
 */
const MCP_DISCLAIMER =
  "只读。不签名、不转账、不兑换。返回的是这次实际取到的链上事实与来源，不构成审计意见或投资建议；取不到的维度不会用样例数据填充。"

function rpcResult(id: unknown, result: unknown) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, result })
}

function rpcError(id: unknown, code: number, message: string) {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } })
}

interface McpTool {
  name: string
  description: string
  inputSchema: {
    type: "object"
    properties: Record<string, unknown>
    required: string[]
    additionalProperties: false
  }
}

function tools(): McpTool[] {
  const listed: McpTool[] = []
  if (listConnectedReadTools().some((tool) => tool.id === "alchemy-mcp-server")) {
    listed.push({
      name: "alchemy_read_chain",
      description:
        "Alchemy 只读链上事实：最新区块，以及可选地址的原生币余额和交易数。只覆盖 Base 与 Ethereum。不是官方 MCP 端点。",
      inputSchema: {
        type: "object",
        properties: {
          chain: { type: "string", enum: ["ethereum", "base"] },
          address: { type: "string", description: "可选，0x 地址" },
        },
        required: ["chain"],
        additionalProperties: false,
      },
    })
  }
  return listed
}

export async function POST(req: Request) {
  const auth = await requireAgentApiKey(req)
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
      instructions: `只读。${MCP_DISCLAIMER}`,
    })
  }
  if (body.method === "notifications/initialized" || body.method === "initialized") {
    return new Response(null, { status: 202 })
  }
  if (body.method === "tools/list") {
    return rpcResult(body.id, { tools: tools() })
  }
  if (body.method === "tools/call") {
    return callTool(auth.subject, body.id, body.params)
  }
  return rpcError(body.id, -32601, "不支持的方法")
}

async function callTool(subject: string, id: unknown, params: unknown) {
  const record = params && typeof params === "object" ? (params as { name?: unknown; arguments?: unknown }) : {}
  const name = typeof record.name === "string" ? record.name : ""
  const args = record.arguments && typeof record.arguments === "object"
    ? (record.arguments as Record<string, unknown>)
    : {}
  const started = Date.now()

  if (name === "alchemy_read_chain" && listConnectedReadTools().some((tool) => tool.id === "alchemy-mcp-server")) {
    if (!isAlchemyConfigured()) {
      return rpcResult(id, { content: [{ type: "text", text: "服务端未配置 Alchemy，本次没有数据" }], isError: true })
    }
    if (!isToolChain(args.chain)) {
      return rpcResult(id, { content: [{ type: "text", text: "chain 只能是 ethereum 或 base" }], isError: true })
    }
    const address = typeof args.address === "string" ? args.address : null
    if (address && !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return rpcResult(id, { content: [{ type: "text", text: "address 必须是 0x 地址" }], isError: true })
    }
    const result = await fetchChainSnapshot({ chain: args.chain, address })
    await recordAgentCall({
      subject,
      source: "mcp",
      tool: "alchemy-mcp-server",
      status: result.ok ? "success" : "error",
      latencyMs: Date.now() - started,
      errorCode: result.ok ? undefined : result.error?.code,
    })
    return rpcResult(id, {
      content: [{ type: "text", text: JSON.stringify(result) }],
      isError: !result.ok,
    })
  }

  return rpcError(id, -32602, "没有这个已接入工具")
}
