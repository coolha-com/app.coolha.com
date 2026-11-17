/**
 * 研究报告章节。缺数据的章节保持缺口文案，不在这里填示例。
 * 链上持有、发行方声明、法定权益是三件不同的事。
 */

export const RIGHTS_DISTINCTION =
  "链上代币持有份额、发行方声明的底层权益、用户依法享有的实际权益是三件不同的事。本结果只记录这次实际读到的链上事实，不把它们互相替代。"

export const NOT_ADVICE =
  "不构成法律意见、合规认证、投资建议或审计保证。没有穷尽链上或链下资料。"

export type ReportSectionId =
  | "executive_summary"
  | "project_overview"
  | "issuer_asset_structure"
  | "token_contract"
  | "cross_chain"
  | "holder_distribution"
  | "supply_transfers"
  | "concentration"
  | "risk_factors"
  | "data_sources_limitations"

export type SectionStatus = "observed" | "partial" | "gap"

export interface ReportSection {
  id: ReportSectionId
  title: string
  status: SectionStatus
  body: string
}

export const REPORT_SECTION_TITLES: Record<ReportSectionId, string> = {
  executive_summary: "Executive Summary",
  project_overview: "Project Overview",
  issuer_asset_structure: "Issuer & Asset Structure",
  token_contract: "Token Contract",
  cross_chain: "Cross-chain",
  holder_distribution: "Holder Distribution",
  supply_transfers: "Supply & Transfers",
  concentration: "Concentration",
  risk_factors: "Risk Factors",
  data_sources_limitations: "Data Sources & Limitations",
}

/** 不依赖某次查询、页面上始终展示的缺口。 */
export const STRUCTURAL_GAPS: ReadonlyArray<{ id: ReportSectionId; title: string; body: string }> = [
  {
    id: "holder_distribution",
    title: REPORT_SECTION_TITLES.holder_distribution,
    body: "缺口：没有持有人索引。单次 RPC 给不出完整持有人集合，这里不提供分布或排名。",
  },
  {
    id: "supply_transfers",
    title: REPORT_SECTION_TITLES.supply_transfers,
    body: "缺口：历史转账、大额转账和资金流需要索引数据源。当前未接入，没有转账列表。",
  },
  {
    id: "concentration",
    title: REPORT_SECTION_TITLES.concentration,
    body: "缺口：Top1 / Top5 / Top10 集中度需要完整持有人集合。当前未计算。",
  },
  {
    id: "issuer_asset_structure",
    title: REPORT_SECTION_TITLES.issuer_asset_structure,
    body: `缺口：发行方披露与法定权益数据源未接入。${RIGHTS_DISTINCTION}`,
  },
]
