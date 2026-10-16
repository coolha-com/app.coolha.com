/**
 * Web3 AI 工具目录（MCP server / Agent skill / CLI）的类型定义。
 *
 * 定位：`/ai/tools` 是**生态选型视图** —— 展示以太坊官方收录的工具长什么样、
 * 各自能做什么、以及我们打算按什么顺序接。
 *
 * ⚠️ 头号决策：**不自研工具层**。行业已收敛出MCP + Agent Skills 标准，
 * 与其平行造一套轮子，不如直接接现成的。我们的增量投入放在
 * 「治理层 + 证据卡 + 用户主权」上，而不是重写数据源。
 *
 * ⚠️ 红线（与项目既有纪律一致）：
 * 1. **本目录不是已接入能力**。这些工具由第三方提供，Coolha 目前**一个都没有接入**。
 *    因此每条都必须带 `integration: "none"`，UI 必须显示「未接入」，禁止出现「已支持 / 可直接调用」。
 * 2. **不代售第三方 key**。接入时服务端永不托管用户或第三方的密钥（延续 BYOK 红线）。
 *    因此 `holdsKeys: true` 的工具只能标 `priority: "no"`。
 * 3. **写操作类工具必须走草稿 + 模拟 + 签名**，永不由服务端代持私钥广播。
 * 4. **许可风险必须落在 `caveats`**（如 wikipethia 论坛内容仅限非商用）——
 *    `access: "reference"` 就是为这类准备的，不接但可借鉴。
 *
 * 数据来源：ethereum.org/developers/tools/categories/agent-tooling/（2026-10-16 实测 31 条）。
 */

/** 工具形态，对应以太坊官方目录的三个分组 */
export type ToolFormat = "mcp" | "skill" | "cli"

/**
 * 风险级别。与工作台治理层的四道闸对应：
 * - `read` 只读：可直接出结果，不涉及签名
 * - `simulate` 模拟 / 沙箱：只产出推演结果，不触碰真实资产
 * - `write` 写操作：会构造并广播真实交易，必须签名授权
 */
export type ToolRisk = "read" | "simulate" | "write"

/**
 * 能力分类（对应 PRD 工具层四类）。
 * `governance` 专指「给 Agent 的授权与权限治理」，是本产品的差异化资产。
 */
export type ToolCategory = "data" | "research" | "dev" | "execute" | "governance"

/** Coolha 的接入状态。当前全部为 `none` —— 目录页只做调研与选型展示。 */
export type ToolIntegration = "none" | "planned" | "live"

/**
 * 接入方式：决定我们以什么形态把这个第三方工具接进来。
 *
 * - `direct`：直接调它的 MCP endpoint 或公开 API（如 Alchemy 托管端点、DefiLlama）
 * - `sidecar`：需要跑它的 MCP server / 插件，我们负责部署与转发
 * - `reference`：只作实现参考，不直接接入（如 wikipethia 许可不允许商用）
 */
export type ToolAccess = "direct" | "sidecar" | "reference"

/**
 * 接入优先级。
 *
 * 排序依据：① 能力覆盖度与不可替代性 ② 数据源稳定性与合规许可 ③ 实现成本。
 * `p0` 第一批动手，`p1` 次之，`p2` 看情况，`no` 明确不接。
 */
export type ToolPriority = "p0" | "p1" | "p2" | "no"

export interface Web3Tool {
  /** 以太坊官方目录条目的 slug */
  id: string
  name: string
  format: ToolFormat
  /** 官方目录的一句话描述（保持原意，中译） */
  summary: string
  category: ToolCategory
  risk: ToolRisk
  /** 支持的链；空数组表示与链无关（如纯开发工具） */
  chains: string[]
  /** 是否需要用户钱包签名才能执行写操作 */
  requiresSignature: boolean
  /** 服务端是否需要持有密钥（按官方文档描述；我们接入时一律改为false） */
  holdsKeys: boolean
  /** 是否开源（许可证名，未知则null） */
  license: string | null
  /** 官方文档地址 */
  url: string
  /** 官方目录标注的工具数量，未标注则 null */
  toolCount: number | null
  /** 我们这边的接入状态；未接入时 UI 必须显示「未接入」 */
  integration: ToolIntegration
  /** 接入后的开放阶段（对应工作台 Phase），仅在 integration 非 none 时有意义 */
  plannedPhase: 1 | 2 | 3 | 4 | null
  /** 打算怎么接：直连 / 需托管 sidecar / 仅作参考 */
  access: ToolAccess
  /** 接入优先级 */
  priority: ToolPriority
  /** 已知风险与限制（许可证、服务端持钥等） */
  caveats: string[]
}