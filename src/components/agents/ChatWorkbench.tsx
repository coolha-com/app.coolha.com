"use client"

import { AgentWorkspace } from "@/components/agents/AgentWorkspace"
import type { PlaygroundModel } from "@/lib/ai-gateway/shared"

/**
 * 智能对话只有一个通道：Agent 执行。
 * 旧的模型对话通道已下线；模型切换在 Agent 通道里通过已验证的 auth 属性
 * 真实生效，且只使用平台模型。
 *
 * 顶部原来有一条「Agent 执行 · eve Runtime · 需登入 …」说明条，已按需求移除——
 * 那是给开发者看的实现细节，不该占用户首屏。
 */
export function ChatWorkbench({
  models,
  defaultModelId,
}: {
  models: PlaygroundModel[]
  defaultModelId: string
}) {
  return <AgentWorkspace models={models} defaultModelId={defaultModelId} />
}
