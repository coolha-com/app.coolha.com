import {
  RiShieldCheckLine,
  RiTeamLine,
  RiCoinLine,
  RiLineChartLine,
  RiMegaphoneLine,
} from "react-icons/ri"
import type { ComponentType } from "react"
import type { DimensionId } from "./types"

/**
 * 五个投前侦察维度。
 *
 * `live: true` 表示该维度**已接入真实数据源**，报告里呈现的数值都是真实抓取的；
 * `live: false` 表示尚未接入 —— 这类维度在报告中一律标记为 unavailable，
 * **不给任何数值、评分或判断**（不做无依据的推测）。
 */
export interface DimensionMeta {
  id: DimensionId
  title: string
  /** 一句话说明这个维度在挖什么 */
  blurb: string
  Icon: ComponentType<{ className?: string }>
  /** 真实数据源工具 id（对应 /ai/tools 目录） */
  dataSourceId: string
  /** 真实数据源展示名 */
  dataSourceLabel: string
  /** 是否已有真实数据源接入 */
  live: boolean
  /** 真实数据的获取方式（对应 sources.ts 的实现） */
  realSource: string
}

export const RESEARCH_DIMENSIONS: DimensionMeta[] = [
  {
    id: "contract",
    title: "智能合约安全",
    blurb: "是否有运行时字节码、源码是否在 Sourcify 验证开源（未验证源码的合约交互风险显著升高）。",
    Icon: RiShieldCheckLine,
    dataSourceId: "sourcify+alchemy",
    dataSourceLabel: "Sourcify + Alchemy",
    live: true,
    realSource:
      "Alchemy eth_getCode 取运行时字节码判是否合约 → Sourcify v2 API 查源码验证状态与验证时间。均已接入（sources.ts: fetchContractFacts）。",
  },
  {
    id: "onchain",
    title: "链上数据投资研究",
    blurb: "当前 ETH 余额、累计发出交易数等真实链上事实（活跃度/资金流需更完整数据源，未接入则不推测）。",
    Icon: RiLineChartLine,
    dataSourceId: "alchemy",
    dataSourceLabel: "Alchemy 链上数据",
    live: true,
    realSource:
      "Alchemy eth_getBalance + eth_getTransactionCount（标准 JSON-RPC）。已接入（sources.ts: fetchOnchainFacts）。活跃地址趋势/资金净流入/鲸鱼动向需增强 API，未接入。",
  },
  {
    id: "token",
    title: "代币投资风险",
    blurb: "DefiLlama 真实价格与协议 TVL；流动性深度、持仓集中度、解锁节奏需专门数据源，未接入则不推测。",
    Icon: RiCoinLine,
    dataSourceId: "defillama",
    dataSourceLabel: "DefiLlama",
    live: true,
    realSource:
      "coins.llama.fi/prices/current/{chain}:{address} 取价格；api.llama.fi/protocol/{slug} 取 TVL。均已接入（sources.ts: fetchTokenFacts，免费公开无需 key）。",
  },
  {
    id: "team",
    title: "项目方 / 团队分析",
    blurb: "部署者画像、关联 scam 地址、资金是否多签托管。需链上实体图谱数据源，当前未接入。",
    Icon: RiTeamLine,
    dataSourceId: "entity-cluster",
    dataSourceLabel: "链上实体图谱（未接入）",
    live: false,
    realSource:
      "需要付费/自建的实体聚类与地址标签数据源（以部署者为种子做关联聚类、标注 scam 触碰、多签占比）。未接入 → 该维度不给任何结论。",
  },
  {
    id: "sentiment",
    title: "媒体热度 / 情绪分析",
    blurb: "社媒讨论量、情绪极性、刷量检测、负面预警。需社交聚合数据源，当前未接入。",
    Icon: RiMegaphoneLine,
    dataSourceId: "media-signals",
    dataSourceLabel: "社交情绪源（未接入）",
    live: false,
    realSource:
      "需要聚合 X / RootData / 行业媒体的提及量与情感模型。未接入 → 该维度不给任何数值（不编造热度或极性）。",
  },
]

export const DIMENSION_BY_ID: Record<DimensionId, DimensionMeta> = Object.fromEntries(
  RESEARCH_DIMENSIONS.map((d) => [d.id, d]),
) as Record<DimensionId, DimensionMeta>
