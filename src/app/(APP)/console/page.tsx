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
} from "@/components/PageShell"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "控制台",
  description: "任务记录。普通用户 API Key 与对外 MCP 当前未启用。",
}

const AGENT_OUTPUT_DISCLAIMER =
  "Agent 的输出只应包含实际取到的事实。没有取到的章节标成缺口。不构成审计意见或投资建议。收银台未接通，未付款不能写成已付款。"

/**
 * 控制台只展示任务。API Key 创建已对普通用户关闭，MCP 不对页面登录开放。
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
            这里查看任务状态。普通用户 API Key 未启用，MCP 只接受内部凭证，不对外开放。
            执行结果见 <InlineLink href="/tasks">历史任务</InlineLink>。
          </>
        }
      />

      <ConsoleDesk signedIn={signedIn && Boolean(subject)} initialKeys={keys} initialSessions={sessions} />

      <SectionHeading>接入说明</SectionHeading>
      <p className="mb-3 text-sm leading-6 text-muted-foreground">
        RWA 读取在 <InlineLink href="/">智能对话</InlineLink> 与{" "}
        <InlineLink href="/data/rwa">RWA 数据</InlineLink> 里。未接通的链和没有数据的章节会标成缺口。
        本页不签发调用凭证，也不提供对外 MCP 配置。
      </p>

      <SectionHeading>MCP</SectionHeading>
      <p className="mb-3 text-sm leading-6 text-muted-foreground">
        <Code>/api/mcp</Code> 仍在，但只接受内部凭证。普通用户 API Key 未启用，不能用它调用。
        持有人分布、历史转账和资金流没有索引数据源。
      </p>
      <p className="mt-4 text-xs leading-6 text-muted-foreground">{AGENT_OUTPUT_DISCLAIMER}</p>
    </PageShell>
  )
}
