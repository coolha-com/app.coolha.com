/**
 * Agent 执行是否免购买开放。
 *
 * 只读进程环境变量 AGENT_ACCESS_MODE，不读请求参数、Cookie 或客户端 Header。
 * 生产环境一律关闭：即使变量被误配成 preview_open / local_open，也不能放开。
 *
 * - local_open：仅本机（不在 Vercel 上）。`next start` 的 NODE_ENV 也是 production，
 *   因此同时认 COOLHA_EVE_LOCAL=1，且该开关不得出现在 Vercel。
 * - preview_open：仅 Vercel Preview，且 Git 分支是 agent，或面向 agent 的 cursor/* 预览。
 * - 其他取值、缺省、环境不匹配：closed。
 */

export type AgentAccessMode = "local_open" | "preview_open" | "closed"

export type AccessRefusal =
  | "production_locked"
  | "local_open_refused"
  | "preview_open_refused"

export interface AccessDecision {
  mode: AgentAccessMode
  open: boolean
  /** 配置了开放模式但被运行环境拒绝时才有值 */
  refused?: AccessRefusal
}

export interface AccessEnv {
  AGENT_ACCESS_MODE?: string
  VERCEL_ENV?: string
  VERCEL?: string
  VERCEL_GIT_COMMIT_REF?: string
  NODE_ENV?: string
  COOLHA_EVE_LOCAL?: string
}

/** agent 分支，以及本仓库云端代理提交到 agent 的 cursor/* 预览分支。 */
export function isPreviewOpenRef(ref: string): boolean {
  return ref === "agent" || ref.startsWith("cursor/")
}

export function decideAgentAccess(env: AccessEnv = process.env): AccessDecision {
  const configured = (env.AGENT_ACCESS_MODE ?? "").trim()
  const vercelEnv = env.VERCEL_ENV ?? ""
  const onVercel = env.VERCEL === "1"
  const ref = env.VERCEL_GIT_COMMIT_REF ?? ""

  if (vercelEnv === "production") {
    return {
      mode: "closed",
      open: false,
      refused:
        configured === "local_open" || configured === "preview_open"
          ? "production_locked"
          : undefined,
    }
  }

  if (configured === "local_open") {
    const local =
      !onVercel && (env.NODE_ENV !== "production" || env.COOLHA_EVE_LOCAL === "1")
    if (local) return { mode: "local_open", open: true }
    return { mode: "closed", open: false, refused: "local_open_refused" }
  }

  if (configured === "preview_open") {
    if (vercelEnv === "preview" && isPreviewOpenRef(ref)) {
      return { mode: "preview_open", open: true }
    }
    return { mode: "closed", open: false, refused: "preview_open_refused" }
  }

  return { mode: "closed", open: false }
}
