import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "接入说明",
  description: "把 RWA Research 的调用方式交给自己的助手。",
}

export default function ConnectPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-normal">接入说明</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        把下面的说明发给 OpenClaw、Codex 或其他个人助手。Coolha 提供的是只读研究服务，不是聊天机器人，也不代持密钥。
      </p>
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-6">
        <li>在侧边栏签名登录，打开 <Link href="/ai/agents/rwa-research" className="underline-offset-4 hover:underline">RWA Research</Link> 并保存 Profile。</li>
        <li>到 <Link href="/console" className="underline-offset-4 hover:underline">控制台</Link> 创建一个 API Key。完整密钥只显示一次。</li>
        <li>助手请求时带上 <code>Authorization: Bearer ck_…</code>。页面登录不能代替这把 Key。</li>
        <li>研究调用 <code>POST /api/v1/agents/rwa-research</code>。远程工具调用 <code>POST /api/mcp</code>。</li>
      </ol>
      <pre className="mt-6 overflow-x-auto rounded-2xl border bg-card p-4 text-xs leading-6">{`curl -X POST "$ORIGIN/api/v1/agents/rwa-research" \\
  -H "Authorization: Bearer ck_你的密钥" \\
  -H "Content-Type: application/json" \\
  -d '{"task":"核查 0x… 的只读事实","targetType":"contract"}'`}</pre>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        细节见 <Link href="/developers" className="underline-offset-4 hover:underline">API 与 MCP</Link>。
        本页不包含 A2A 或 x402。
      </p>
    </div>
  )
}
