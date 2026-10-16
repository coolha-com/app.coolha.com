import type { IconType } from "react-icons"
import {
  RiBracesLine,
  RiDatabase2Line,
  RiFileSearchLine,
  RiCodeSSlashLine,
  RiSwapBoxLine,
  RiShieldKeyholeLine,
  RiCommandLine,
  RiPuzzleLine,
} from "react-icons/ri"
import type {
  ToolAccess,
  ToolCategory,
  ToolFormat,
  ToolIntegration,
  ToolPriority,
  ToolRisk,
  Web3Tool,
} from "./types"
import { WEB3_TOOLS } from "./catalog"

/** 形态标签（MCP server / Agent skill / CLI） */
export const TOOL_FORMAT_LABELS: Record<ToolFormat, string> = {
  mcp: "MCP Server",
  skill: "Agent Skill",
  cli: "CLI",
}

export const TOOL_FORMAT_ICONS: Record<ToolFormat, IconType> = {
  mcp: RiBracesLine,
  skill: RiPuzzleLine,
  cli: RiCommandLine,
}

/** 能力分类标签，对应工作台工具层的四类 + 治理类 */
export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  data: "链上数据",
  research: "研究与规范",
  dev: "开发与安全",
  execute: "执行与交易",
  governance: "授权与治理",
}

export const TOOL_CATEGORY_ICONS: Record<ToolCategory, IconType> = {
  data: RiDatabase2Line,
  research: RiFileSearchLine,
  dev: RiCodeSSlashLine,
  execute: RiSwapBoxLine,
  governance: RiShieldKeyholeLine,
}

/**
 * 风险级别标签。
 * `write` 用警示色——因为这类工具会真实动钱，是页面里最需要被看见的一列。
 */
export const TOOL_RISK_LABELS: Record<ToolRisk, string> = {
  read: "只读",
  simulate: "模拟",
  write: "写操作",
}

export const TOOL_RISK_ICONS: Record<ToolRisk, IconType> = {
  read: RiDatabase2Line,
  simulate: RiBracesLine,
  write: RiSwapBoxLine,
}

/** 接入状态标签：当前目录全部为「未接入」 */
export const TOOL_INTEGRATION_LABELS: Record<ToolIntegration, string> = {
  none: "未接入",
  planned: "规划中",
  live: "已接入",
}

/**
 * 接入方式标签。
 * `direct` 最省事（调它的端点即可）；`sidecar` 要我们部署转发；
 * `reference` 是「不接但值得读源码」。
 */
export const TOOL_ACCESS_LABELS: Record<ToolAccess, string> = {
  direct: "直连端点",
  sidecar: "需托管部署",
  reference: "仅作参考",
}

/** 接入优先级标签与排序权重 */
export const TOOL_PRIORITY_LABELS: Record<ToolPriority, string> = {
  p0: "P0 第一批",
  p1: "P1 次批",
  p2: "P2 看情况",
  no: "不接入",
}

export const TOOL_PRIORITY_ORDER: Record<ToolPriority, number> = {
  p0: 0,
  p1: 1,
  p2: 2,
  no: 3,
}

/** 工具分类 → 是否需要登录 / 签名（用于详情页说明调用前置条件） */
export const TOOL_CATEGORY_PREREQS: Record<ToolCategory, string[]> = {
  data: ["匿名可用（有速率限制）", "登录后解除限速"],
  research: ["需签名登录", "产出附来源引用"],
  dev: ["需签名登录", "产出物不落链上"],
  execute: ["需签名登录", "先模拟再签名", "服务端不持钥"],
  governance: ["需签名登录", "授权链上可撤"],
}

export interface ToolFilterState {
  search: string
  format: ToolFormat | "all"
  category: ToolCategory | "all"
  risk: ToolRisk | "all"
  priority: ToolPriority | "all"
  /** 只看需要用户签名的 */
  signatureOnly: boolean
}

export const DEFAULT_TOOL_FILTERS: ToolFilterState = {
  search: "",
  format: "all",
  category: "all",
  risk: "all",
  priority: "all",
  signatureOnly: false,
}

/** 目录统计（服务端与客户端共用，避免重复遍历逻辑） */
export function summarizeTools(tools: Web3Tool[]) {
  return {
    total: tools.length,
    mcp: tools.filter((t) => t.format === "mcp").length,
    skill: tools.filter((t) => t.format === "skill").length,
    cli: tools.filter((t) => t.format === "cli").length,
    live: tools.filter((t) => t.integration === "live").length,
    write: tools.filter((t) => t.risk === "write").length,
    p0: tools.filter((t) => t.priority === "p0").length,
    p1: tools.filter((t) => t.priority === "p1").length,
    p2: tools.filter((t) => t.priority === "p2").length,
    rejected: tools.filter((t) => t.priority === "no").length,
    /** 官方标注了工具数量的条目，其工具总数 */
    declaredToolTotal: tools.reduce((sum, t) => sum + (t.toolCount ?? 0), 0),
  }
}

/** 按筛选条件过滤工具；纯函数，服务端与客户端共用 */
export function filterTools(tools: Web3Tool[], filters: ToolFilterState): Web3Tool[] {
  const keyword = filters.search.trim().toLowerCase()

  return tools.filter((tool) => {
    if (filters.format !== "all" && tool.format !== filters.format) return false
    if (filters.category !== "all" && tool.category !== filters.category) return false
    if (filters.risk !== "all" && tool.risk !== filters.risk) return false
    if (filters.priority !== "all" && tool.priority !== filters.priority) return false
    if (filters.signatureOnly && !tool.requiresSignature) return false
    if (!keyword) return true
    return (
      tool.name.toLowerCase().includes(keyword) ||
      tool.summary.toLowerCase().includes(keyword) ||
      tool.chains.some((chain) => chain.toLowerCase().includes(keyword))
    )
  })
}

/** 按分类分组（保持 TOOL_CATEGORY_LABELS 的声明顺序） */
export function groupByCategory(tools: Web3Tool[]): Array<[ToolCategory, Web3Tool[]]> {
  const order = Object.keys(TOOL_CATEGORY_LABELS) as ToolCategory[]
  return order
    .map((category) => [category, tools.filter((t) => t.category === category)] as [ToolCategory, Web3Tool[]])
    .filter(([, list]) => list.length > 0)
}

export { WEB3_TOOLS }