import type { Metadata } from "next"
import { RiKey2Line, RiRobot2Line } from "react-icons/ri"
import { ConsoleDesk } from "@/components/agents/ConsoleDesk"
import { getWalletSessionFromCookies } from "@/lib/neon/wallet-auth"
import { resolveSubject } from "@/lib/neon/identity"
import { listAgentApiKeys } from "@/lib/agents/api-keys"
import { listRwaRuns } from "@/lib/neon/rwa-research"
import { REPORT_DISCLAIMER } from "@/lib/research/labels"
import {
  Code,
  EntryCard,
  InlineLink,
  PageHeader,
  PageShell,
  SectionHeading,
  Surface,
} from "@/components/PageShell"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "控制台",
  description: "API Key、任务记录、运行状态，以及接入说明与 API/MCP 文档。",
}

// \u005c 是 shell 续行反斜杠，用转义写法避免模板字符串歧义
const CURL_EXAMPLE = `curl -X POST "$ORIGIN/api/v1/agents/rwa-research" \u005c
  -H "Authorization: Bearer ck_你的密钥" \u005c
  -H "Content-Type: application/json" \u005c
  -d '{"task":"核查 0x… 的只读事实","targetType":"contract"}'`

/**
 * 开发者控制台：API Key 工作台 + 已下线的 /connect、/developers 两页内容。
 * 原两页已删除，旧 URL 由 next.config.ts 的 redirects 兜底到本页。
 */
export default async function ConsolePage() {
  const session = await getWalletSessionFromCookies()
  const signedIn = Boolean(session?.address)
  const subject = signedIn && session?.address ? await resolveSubject(session.address).catch(() => null) : null
  const keys = subject ? await listAgentApiKeys(subject).catch(() => []) : []
  const runs = subject ? await listRwaRuns(subject, 20).catch(() => []) : []

  return (
    <PageShell>
      <PageHeader
        title="控制台"
        description={
          <>
            管理 API Key，并查看这项研究服务的任务状态。外部请求的权限只来自 Key，不来自这个页面的登录。
            订单与执行结果在 <InlineLink href="/tasks">任务</InlineLink>。
          </>
        }
      />

      <ConsoleDesk signedIn={signedIn && Boolean(subject)} initialKeys={keys} initialRuns={runs} />

      <SectionHeading>页面入口</SectionHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        <EntryCard
          title="模型广场"
          description="模型目录与价格查询；赞助模型可在 Chat 中对话，其余请用自定义模型配置。"
          href="/console/models"
          hrefLabel="打开模型广场"
          icon={RiRobot2Line}
        />
        <EntryCard
          title="API 连接"
          description="配置你自己的模型服务（BYOK）。密钥只保存在浏览器，不上行服务端。"
          href="/console/api-keys"
          hrefLabel="配置自定义模型"
          icon={RiKey2Line}
        />
      </div>

      <SectionHeading>接入说明</SectionHeading>
      <p className="mb-3 text-sm leading-6 text-muted-foreground">
        把下面的说明发给 OpenClaw、Codex 或其他个人助手。Coolha 提供的是只读研究服务，不是聊天机器人，也不代持密钥。
      </p>
      <Surface
        as="ol"
        className="list-decimal space-y-3 py-4 pl-9 pr-4 leading-6 marker:font-medium marker:text-muted-foreground"
      >
        <li>在侧边栏签名登录，打开 <InlineLink href="/agents/rwa-research">RWA Research</InlineLink> 并保存 Profile。</li>
        <li>在本页创建一个 API Key。完整密钥只显示一次。</li>
        <li>助手请求时带上 <Code>Authorization: Bearer ck_…</Code>。页面登录不能代替这把 Key。</li>
        <li>研究调用 <Code>POST /api/v1/agents/rwa-research</Code>。远程工具调用 <Code>POST /api/mcp</Code>。</li>
      </Surface>
      <pre className="mt-3 overflow-x-auto rounded-4xl bg-card p-4 font-mono text-xs leading-6 shadow-sm ring-1 ring-foreground/5">{CURL_EXAMPLE}</pre>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        细节见下方「API 与 MCP」。本页不包含 A2A 或 x402。
      </p>

      <SectionHeading>API 与 MCP</SectionHeading>
      <p className="mb-3 text-sm leading-6 text-muted-foreground">
        外部助手用 API Key 调用同一个只读研究服务。不按 token 计价，也不把赞助模型推理转售出去。
      </p>
      <h3 className="mb-2 text-sm font-medium">HTTP</h3>
      <Surface>
        <ul className="list-disc space-y-2 pl-5 leading-6">
          <li><Code>POST /api/v1/agents/rwa-research</Code>，正文 <Code>{`{ "task", "targetType" }`}</Code></li>
          <li><Code>GET /api/v1/agents/rwa-research/runs/:id</Code> 只返回这把 Key 所属用户的记录</li>
          <li>必须先在网站保存 Profile。API 不调用赞助模型。</li>
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
      "headers": { "Authorization": "Bearer ck_你的密钥" }
    }
  }
}`}</pre>
      <p className="mt-4 text-xs leading-6 text-muted-foreground">{REPORT_DISCLAIMER}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        A2A 与 x402 不在这一期。创建 Key 请在本页上方操作。
      </p>
    </PageShell>
  )
}
