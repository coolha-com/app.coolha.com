import type { Metadata } from "next"
import { ConsoleDesk } from "@/components/agents/ConsoleDesk"
import { getCurrentUser } from "@/lib/neon/session"
import { listAgentApiKeys } from "@/lib/agents/api-keys"
import { listChatSessions } from "@/lib/neon/chat-sessions"
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

const MCP_EXAMPLE = `{
  "mcpServers": {
    "coolha": {
      "url": "$ORIGIN/api/mcp",
      "headers": { "Authorization": "Bearer ck_你的凭证" }
    }
  }
}`

/**
 * AaaS 的统一免责口径（原先挂在已下线的侦察报告上）。
 * 只陈述事实边界，不做结论性承诺。
 */
const AGENT_OUTPUT_DISCLAIMER =
  "Agent 的输出是基于公开数据与模型推理得到的研究结论，不构成审计意见或投资建议。没有取到的数据会明确标注「未接入」，不会用样例数据填充。"

/**
 * 开发者控制台（AaaS）：只陈列「调用 Coolha Agent 服务」所需的凭证、任务状态与接入说明。
 *
 * 投前侦察与一次性研究 API 已下线：现在对外只保留 MCP 的只读链工具，
 * 按次付费的 RWA 尽调 Agent 在智能对话里执行（见 /tasks 的历史任务）。
 */
export default async function ConsolePage() {
  const user = await getCurrentUser()
  const signedIn = Boolean(user)
  const subject = user?.subject ?? null
  const keys = subject ? await listAgentApiKeys(subject).catch(() => []) : []
  const sessions = subject ? await listChatSessions(subject, 20).catch(() => []) : []

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

      <ConsoleDesk signedIn={signedIn && Boolean(subject)} initialKeys={keys} initialSessions={sessions} />

      <SectionHeading>接入说明</SectionHeading>
      <p className="mb-3 text-sm leading-6 text-muted-foreground">
        把下面的说明发给 OpenClaw、Codex 或其他个人助手。Coolha 交付的是 Agent 执行能力：
        模型与执行环境由平台统一提供，按 Agent 服务计费。
      </p>
      <Surface
        as="ol"
        className="list-decimal space-y-3 py-4 pl-9 pr-4 leading-6 marker:font-medium marker:text-muted-foreground"
      >
        <li>在 <InlineLink href="/">智能对话</InlineLink> 里选择 RWA 尽调 Agent，配置参数后开始任务。</li>
        <li>在本页创建一个调用凭证。完整凭证只显示一次。</li>
        <li>助手请求时带上 <Code>Authorization: Bearer ck_…</Code>。页面登录不能代替这把凭证。</li>
        <li>远程工具调用 <Code>POST /api/mcp</Code>。</li>
      </Surface>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        细节见下方「MCP」。本页不包含 A2A 或 x402。
      </p>

      <SectionHeading>MCP</SectionHeading>
      <p className="mb-3 text-sm leading-6 text-muted-foreground">
        外部助手用调用凭证调用同一个 Agent 服务。当前工具只有目录里已经标成已接入的
        <Code> Alchemy 只读链</Code>；未接入的工具不会出现。按 Agent 服务计费，模型与执行环境由平台统一提供。
      </p>
      <pre className="mt-3 overflow-x-auto rounded-4xl bg-card p-4 font-mono text-xs leading-6 shadow-sm ring-1 ring-foreground/5">{MCP_EXAMPLE}</pre>
      <p className="mt-4 text-xs leading-6 text-muted-foreground">{AGENT_OUTPUT_DISCLAIMER}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        A2A 与 x402 不在这一期。创建凭证请在本页上方操作。
      </p>
    </PageShell>
  )
}
