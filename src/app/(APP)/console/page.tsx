import type { Metadata } from "next"
import { ConsoleDesk } from "@/components/agents/ConsoleDesk"
import { getCurrentUser } from "@/lib/neon/session"
import { listAgentApiKeys } from "@/lib/agents/api-keys"
import { listRwaRuns } from "@/lib/neon/rwa-research"
import { REPORT_DISCLAIMER } from "@/lib/research/labels"
import {
  Code,
  InlineLink,
  PageHeader,
  PageShell,
  SectionHeading,
  Surface,
} from "@/components/PageShell"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "控制台",
  description: "AaaS 开发者控制台：Agent 服务调用凭证、任务记录，以及 API/MCP 接入说明。",
}

// \u005c 是 shell 续行反斜杠，用转义写法避免模板字符串歧义
const CURL_EXAMPLE = `curl -X POST "$ORIGIN/api/v1/agents/rwa-research" \u005c
  -H "Authorization: Bearer ck_你的凭证" \u005c
  -H "Content-Type: application/json" \u005c
  -d '{"task":"核查 0x… 的只读事实","targetType":"contract"}'`

/**
 * 开发者控制台（AaaS）：只陈列「调用 Coolha Agent 服务」所需的凭证、任务状态与接入说明。
 *
 * 这里是 Agent as a Service：模型与执行环境由平台统一提供，按 Agent 服务计费，
 * 不按 token 分档，控制台只负责调用凭证与接入说明。
 * 模型广场入口已移到 /agents（智能服务）。
 * 原 /connect、/developers 两页已删除，旧 URL 由 next.config.ts 的 redirects 兜底到本页。
 */
export default async function ConsolePage() {
  const user = await getCurrentUser()
  const signedIn = Boolean(user)
  const subject = user?.subject ?? null
  const keys = subject ? await listAgentApiKeys(subject).catch(() => []) : []
  const runs = subject ? await listRwaRuns(subject, 20).catch(() => []) : []

  return (
    <PageShell>
      <PageHeader
        title="控制台"
        description={
          <>
            Coolha 是 AaaS（Agent as a Service）：按 Agent 服务计费，不卖算力、不按 token 分档。
            这里管理调用 Agent 服务的凭证并查看任务状态；外部调用权限只来自这把凭证，不来自页面登录。
            执行结果见 <InlineLink href="/tasks">历史任务</InlineLink>。
          </>
        }
      />

      <ConsoleDesk signedIn={signedIn && Boolean(subject)} initialKeys={keys} initialRuns={runs} />

      <SectionHeading>接入说明</SectionHeading>
      <p className="mb-3 text-sm leading-6 text-muted-foreground">
        把下面的说明发给 OpenClaw、Codex 或其他个人助手。Coolha 交付的是 Agent 执行能力：
        模型与执行环境由平台统一提供，按 Agent 服务计费。
      </p>
      <Surface
        as="ol"
        className="list-decimal space-y-3 py-4 pl-9 pr-4 leading-6 marker:font-medium marker:text-muted-foreground"
      >
        <li>在侧边栏登入，打开 <InlineLink href="/agents/rwa-research">RWA Research</InlineLink> 并保存 Profile。</li>
        <li>在本页创建一个调用凭证。完整凭证只显示一次。</li>
        <li>助手请求时带上 <Code>Authorization: Bearer ck_…</Code>。页面登录不能代替这把凭证。</li>
        <li>研究调用 <Code>POST /api/v1/agents/rwa-research</Code>。远程工具调用 <Code>POST /api/mcp</Code>。</li>
      </Surface>
      <pre className="mt-3 overflow-x-auto rounded-4xl bg-card p-4 font-mono text-xs leading-6 shadow-sm ring-1 ring-foreground/5">{CURL_EXAMPLE}</pre>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        细节见下方「API 与 MCP」。本页不包含 A2A 或 x402。
      </p>

      <SectionHeading>API 与 MCP</SectionHeading>
      <p className="mb-3 text-sm leading-6 text-muted-foreground">
        外部助手用调用凭证执行同一个 Agent 服务。按 Agent 服务计费，模型与执行环境由平台统一提供。
      </p>
      <h3 className="mb-2 text-sm font-medium">HTTP</h3>
      <Surface>
        <ul className="list-disc space-y-2 pl-5 leading-6">
          <li><Code>POST /api/v1/agents/rwa-research</Code>，正文 <Code>{`{ "task", "targetType" }`}</Code></li>
          <li><Code>GET /api/v1/agents/rwa-research/runs/:id</Code> 只返回这把凭证所属用户的记录</li>
          <li>必须先在网站保存 Profile。API 只执行已接入的 Agent 服务，不提供通用模型推理接口。</li>
          <li>响应里的订单付款状态是未付款。地理硬屏蔽地区返回 451。</li>
        </ul>
      </Surface>
      <h3 className="mb-2 mt-5 text-sm font-medium">MCP</h3>
      <p className="text-sm leading-6">
        <Code>POST /api/mcp</Code>，JSON-RPC 2.0。当前工具只有 <Code>rwa_research</Code>，以及目录里已经标成已接入的 Alchemy 只读链。未接入的工具不会出现。
      </p>
      <pre className="mt-3 overflow-x-auto rounded-4xl bg-card p-4 font-mono text-xs leading-6 shadow-sm ring-1 ring-foreground/5">{`{
  "mcpServers": {
    "coolha-rwa": {
      "url": "$ORIGIN/api/mcp",
      "headers": { "Authorization": "Bearer ck_你的凭证" }
    }
  }
}`}</pre>
      <p className="mt-4 text-xs leading-6 text-muted-foreground">{REPORT_DISCLAIMER}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        A2A 与 x402 不在这一期。创建凭证请在本页上方操作。
      </p>
    </PageShell>
  )
}
