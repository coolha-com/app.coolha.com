import "server-only"

import { generateResearchReport } from "@/lib/research/engine"
import type { TargetType } from "@/lib/research/types"
import {
  listConnectedReadTools,
  parseResearchTask,
  snapshotFromProfile,
  toStoredReport,
  type ProfileInput,
  type ResearchRunView,
} from "@/lib/agents/rwa-research"
import { narrateSponsoredReport } from "@/lib/agents/narrate"
import {
  finishRwaRun,
  getRwaProfile,
  getRwaRun,
  insertRwaRun,
} from "@/lib/neon/rwa-research"

export class RwaResearchError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = "RwaResearchError"
  }
}

function publicError(error: unknown): string {
  const message = error instanceof Error ? error.message : "执行失败"
  return message.replace(/sk-[A-Za-z0-9]+/g, "[redacted]").slice(0, 240)
}

export async function executeRwaResearch(input: {
  subject: string
  task: string
  targetType: TargetType
  channel: "web" | "api" | "mcp"
  geoTier: string | null
  /** 外部 API / MCP 不调用赞助模型，避免把推理通道转给第三方。 */
  allowSponsoredNarrative: boolean
  profile?: ProfileInput | null
}): Promise<ResearchRunView> {
  const task = input.task.trim()
  if (task.length < 2 || task.length > 2000) {
    throw new RwaResearchError("INVALID_TASK", "任务长度需在 2–2000 字符之间", 400)
  }

  const profile = input.profile ?? (await getRwaProfile(input.subject))
  if (!profile) {
    throw new RwaResearchError("PROFILE_REQUIRED", "请先保存 RWA Research 的 Agent Profile", 400)
  }

  const parsed = parseResearchTask(task, input.targetType)
  const snapshot = snapshotFromProfile(profile)
  const inserted = await insertRwaRun({
    subject: input.subject,
    taskText: task,
    target: parsed.target,
    targetType: parsed.targetType,
    geoTier: input.geoTier,
    channel: input.channel,
    snapshot,
  })

  try {
    const report = toStoredReport(
      await generateResearchReport(parsed.target, snapshot.dimensions, parsed.targetType),
    )
    let narrative: string | null = null
    let narrativeSource: "none" | "sponsored" = "none"
    let narrativeNote = "研究管线已执行。本次没有调用赞助模型。"

    if (
      input.allowSponsoredNarrative &&
      input.channel === "web" &&
      profile.modelMode === "sponsored" &&
      profile.sponsoredModelSlug
    ) {
      const outcome = await narrateSponsoredReport({
        subject: input.subject,
        slug: profile.sponsoredModelSlug,
        report,
      })
      narrative = outcome.text
      narrativeSource = outcome.source
      narrativeNote = outcome.note
    }

    if (snapshot.excludedToolIds.includes("alchemy-mcp-server")) {
      narrativeNote = `已排除 Alchemy 读链，因此没有查询合约字节码和链上余额。${narrativeNote}`
    }
    if (listConnectedReadTools().length === 0) {
      narrativeNote = `当前没有已接入的只读工具。${narrativeNote}`
    }

    await finishRwaRun({
      subject: input.subject,
      executionId: inserted.executionId,
      status: "succeeded",
      report,
      narrative,
      narrativeSource,
      narrativeNote,
      errorMessage: null,
    })
  } catch (error) {
    await finishRwaRun({
      subject: input.subject,
      executionId: inserted.executionId,
      status: "failed",
      report: null,
      narrative: null,
      narrativeSource: "none",
      narrativeNote: null,
      errorMessage: publicError(error),
    }).catch(() => undefined)
    const failed = await getRwaRun(input.subject, inserted.orderId)
    if (failed) return failed
    throw new RwaResearchError("EXECUTION_FAILED", "研究执行失败，记录已保留", 500)
  }

  const run = await getRwaRun(input.subject, inserted.orderId)
  if (!run) throw new RwaResearchError("EXECUTION_FAILED", "执行记录写入后无法按当前用户读回", 500)
  return run
}
