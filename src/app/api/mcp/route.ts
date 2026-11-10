import { RwaResearchError, executeRwaResearch } from "@/lib/agents/execute"
import { readGeoTier } from "@/lib/agents/http"
import { recordAgentCall, requireAgentApiKey } from "@/lib/agents/api-auth"
import { containsSecretValue, isTargetType, listConnectedReadTools } from "@/lib/agents/rwa-research"
import { REPORT_DISCLAIMER } from "@/lib/research/labels"
import { fetchChainSnapshot, isAlchemyConfigured, isToolChain } from "@/lib/web3-tools/alchemy"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const SERVER_INFO = { name: "coolha-rwa-research", version: "0.1.0" }

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
  const listed: McpTool[] = [
    {
      name: "rwa_research",
      description:
        "对一个合约、代币或项目做只读研究。只返回这次实际取到的事实、来源、时间和既有免责声明。不签名、不转账、不兑换，不打 0-100 分。",
      inputSchema: {
        type: "object",
        properties: {
          task: { type: "string", description: "研究任务，可包含 0x 地址" },
          targetType: { type: "string", enum: ["contract", "token", "project"] },
        },
        required: ["task"],
        additionalProperties: false,
      },
    },
  ]
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
      instructions: `只读。${REPORT_DISCLAIMER}`,
    })
  }
  if (body.method === "notifications/initialized" || body.method === "initialized") {
    return new Response(null, { status: 202 })
  }
  if (body.method === "tools/list") {
    return rpcResult(body.id, { tools: tools() })
  }
  if (body.method === "tools/call") {
    return callTool(auth.subject, body.id, body.params, readGeoTier(req))
  }
  return rpcError(body.id, -32601, "不支持的方法")
}

async function callTool(subject: string, id: unknown, params: unknown, geoTier: string | null) {
  const record = params && typeof params === "object" ? (params as { name?: unknown; arguments?: unknown }) : {}
  const name = typeof record.name === "string" ? record.name : ""
  const args = record.arguments && typeof record.arguments === "object"
    ? (record.arguments as Record<string, unknown>)
    : {}
  const started = Date.now()

  if (name === "rwa_research") {
    const task = typeof args.task === "string" ? args.task : ""
    if (containsSecretValue(task)) {
      return rpcResult(id, { content: [{ type: "text", text: "任务文本里不能包含密钥" }], isError: true })
    }
    try {
      const run = await executeRwaResearch({
        subject,
        task,
        targetType: isTargetType(args.targetType) ? args.targetType : "contract",
        channel: "mcp",
        geoTier,
        allowSponsoredNarrative: false,
      })
      await recordAgentCall({
        subject,
        source: "rwa-mcp",
        tool: "rwa-research",
        status: run.status === "failed" ? "error" : "success",
        latencyMs: Date.now() - started,
      })
      return rpcResult(id, {
        content: [{ type: "text", text: JSON.stringify({ run, disclaimer: run.report?.disclaimer ?? REPORT_DISCLAIMER }) }],
        isError: run.status === "failed",
      })
    } catch (error) {
      await recordAgentCall({
        subject,
        source: "rwa-mcp",
        tool: "rwa-research",
        status: "error",
        latencyMs: Date.now() - started,
        errorCode: error instanceof RwaResearchError ? error.code : "EXECUTION_FAILED",
      })
      const message = error instanceof RwaResearchError ? error.message : "研究执行失败"
      return rpcResult(id, { content: [{ type: "text", text: message }], isError: true })
    }
  }

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
      source: "rwa-mcp",
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
