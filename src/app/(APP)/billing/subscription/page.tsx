import type { Metadata } from "next"
import {
  Notice,
  PageHeader,
  PageShell,
  SectionHeading,
  Surface,
} from "@/components/PageShell"
import { getCurrentUser } from "@/lib/neon/session"
import { decideAgentAccess } from "@/lib/agents/access-mode"
import { isInferenceReady, INFERENCE_DEFAULT_MODEL, INFERENCE_GATEWAY_NAME } from "@/lib/inference/config"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Agent 服务说明",
  description: "当前阶段的 Agent 服务说明。不收款，也不展示付款状态。",
}

export default async function AgentServicePage() {
  const user = await getCurrentUser()
  const access = decideAgentAccess()
  const ready = isInferenceReady()
  const modeLabel =
    access.mode === "local_open"
      ? "本地开发测试"
      : access.mode === "preview_open"
        ? "预览开发测试"
        : "未开放"

  return (
    <PageShell>
      <PageHeader
        title="Agent 服务"
        description="Coolha 提供的是 Agent 执行与交付，不是模型 API 额度转售。当前阶段不收款。"
      />

      <Surface>
        <p className="text-sm">访问模式：{modeLabel}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          网关 {INFERENCE_GATEWAY_NAME} · 默认模型 {INFERENCE_DEFAULT_MODEL || "未配置"} ·
          推理{ready ? "已配置" : "未配置"}
        </p>
      </Surface>

      {access.open ? (
        <Notice className="mt-4">
          这个环境可以不购买直接测试 Agent。用量会记到你的账号上，达到测试预算后会暂停。
          生产环境不会因为这里的说明而变成开放模式。
        </Notice>
      ) : (
        <Notice className="mt-4">
          生产环境在正式商业化之前不开放未经授权的执行。这里没有收银台，也不会生成订单。
        </Notice>
      )}

      {!user ? <Notice className="mt-4">请先在侧边栏登入后再开始任务。</Notice> : null}

      <SectionHeading>现在能做什么</SectionHeading>
      <ul className="space-y-2">
        <Surface as="li">在工作台选择 RWA Research Agent，配置约束后开始任务。</Surface>
        <Surface as="li">模型只能从服务端白名单里选。</Surface>
        <Surface as="li">对话、工具过程和用量记在你自己的账号下。</Surface>
      </ul>
    </PageShell>
  )
}
