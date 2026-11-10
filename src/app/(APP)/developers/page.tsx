import type { Metadata } from "next"
import Link from "next/link"
import { REPORT_DISCLAIMER } from "@/lib/research/labels"

export const metadata: Metadata = {
  title: "API 与 MCP",
  description: "RWA Research 的 HTTP API 和远程 MCP。",
}

export default function DevelopersPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-normal">API 与 MCP</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        外部助手用 API Key 调用同一个只读研究服务。不按 token 计价，也不把赞助模型推理转售出去。
      </p>
      <h2 className="mt-6 text-base font-medium">HTTP</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6">
        <li><code>POST /api/v1/agents/rwa-research</code>，正文 <code>{`{ "task", "targetType" }`}</code></li>
        <li><code>GET /api/v1/agents/rwa-research/runs/:id</code> 只返回这把 Key 所属用户的记录</li>
        <li>必须先在网站保存 Profile。API 不调用赞助模型。</li>
        <li>响应里的订单付款状态是未付款。地理硬屏蔽地区返回 451。</li>
      </ul>
      <h2 className="mt-6 text-base font-medium">MCP</h2>
      <p className="mt-2 text-sm leading-6">
        <code>POST /api/mcp</code>，JSON-RPC 2.0。当前工具只有 <code>rwa_research</code>，以及目录里已经标成已接入的 Alchemy 只读链。未接入的工具不会出现。
      </p>
      <pre className="mt-4 overflow-x-auto rounded-2xl border bg-card p-4 text-xs leading-6">{`{
  "mcpServers": {
    "coolha-rwa": {
      "url": "$ORIGIN/api/mcp",
      "headers": { "Authorization": "Bearer ck_你的密钥" }
    }
  }
}`}</pre>
      <p className="mt-6 text-xs leading-6 text-muted-foreground">{REPORT_DISCLAIMER}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        A2A 与 x402 不在这一期。创建 Key 请到 <Link href="/console" className="underline-offset-4 hover:underline">控制台</Link>。
      </p>
    </div>
  )
}
