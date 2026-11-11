import { WEB3_TOOLS } from "@/lib/web3-tools/catalog"

/**
 * Agent 服务的共享契约（2026-11-12 投前侦察下线后从 lib/agents/rwa-research 精简而来）。
 *
 * 投前侦察（5 维度报告引擎）整块删除后，只剩三类跨模块共用的东西留在这里：
 *  1. 任务约束（只读 / 必须标注来源 / 不得把未验证信息当事实）；
 *  2. 密钥值检测（创建调用凭证时拒绝带密钥的 label）；
 *  3. 已接入的只读工具清单（工具目录里真正 live 且 read 的条目）。
 *
 * 不再保留任何报告结构、风险评分或维度枚举——那些只属于已下线的侦察产品。
 */

export interface TaskConstraints {
  readOnly: boolean
  citeSources: boolean
  unverifiedNotFact: boolean
}

/** 三条约束必须同时为真，这是这项服务的准入条件。 */
export function constraintsAccepted(value: TaskConstraints): boolean {
  return value.readOnly === true && value.citeSources === true && value.unverifiedNotFact === true
}

export interface ConnectedToolOption {
  id: string
  name: string
  liveScope: string
}

/** 只返回目录里真正 live、且只读的工具。未接入的条目不会出现。 */
export function listConnectedReadTools(): ConnectedToolOption[] {
  return WEB3_TOOLS.filter((tool) => tool.integration === "live" && tool.risk === "read").map(
    (tool) => ({
      id: tool.id,
      name: tool.name,
      liveScope: tool.liveScope ?? "",
    }),
  )
}

const SECRET_VALUE = /(?:sk-[A-Za-z0-9]{8,}|Bearer\s+\S{8,}|api[_-]?key\s*[:=]\s*\S+)/i

/** 文本里是否含疑似密钥：拒绝把它写进会入库的字段。 */
export function containsSecretValue(text: string): boolean {
  return SECRET_VALUE.test(text)
}
