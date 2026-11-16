import { CHAIN_REGISTRY, chainDisplayStatus, type ChainRegistryEntry } from "@/lib/chains/registry"
import {
  NOT_ADVICE,
  REPORT_SECTION_TITLES,
  RIGHTS_DISTINCTION,
  type ReportSection,
  type ReportSectionId,
} from "@/lib/rwa/sections"

export interface TokenObservation {
  chainKey: string
  chainLabel: string
  chainId: number
  endpoint: string
  address: string
  isContract: boolean | null
  name: string | null
  symbol: string | null
  decimals: number | null
  totalSupplyRaw: string | null
  totalSupplyDisplay: string | null
  holderAddress: string | null
  holderBalanceRaw: string | null
  holderBalanceDisplay: string | null
  holderShare: string | null
  implementationHint: string | null
  blockNumber: number | null
  blockTime: string | null
  unknown: string[]
  fetchedAt: string
}

export interface ResearchReport {
  sections: ReportSection[]
  paymentStatus: "unpaid"
  disclaimer: string
}

function section(id: ReportSectionId, status: ReportSection["status"], body: string): ReportSection {
  return { id, title: REPORT_SECTION_TITLES[id], status, body }
}

function chainLine(entries: ChainRegistryEntry[], label: string): string {
  if (entries.length === 0) return `${label}：无`
  return `${label}：${entries.map((entry) => entry.label).join("、")}`
}

export function buildResearchReport(input: {
  token: TokenObservation | null
  failure: string | null
  persisted: boolean
  persistenceNote: string
}): ResearchReport {
  const token = input.token
  const chainSummary = (["未核验", "未接入", "已接通"] as const)
    .map((status) => {
      const entries = CHAIN_REGISTRY.filter((entry) => chainDisplayStatus(entry) === status)
      return entries.length === 0 ? "" : chainLine(entries, status)
    })
    .filter(Boolean)
    .join("。")

  const identity =
    token && (token.symbol || token.name)
      ? [token.symbol, token.name].filter(Boolean).join(" / ")
      : null

  const executive = !token
    ? section(
        "executive_summary",
        "gap",
        input.failure ?? "这次没有取到链上事实，摘要不填数值。",
      )
    : section(
        "executive_summary",
        "partial",
        [
          `只覆盖 ${token.chainLabel} 上 ${token.address} 这一次读取。`,
          identity ? `链上读到的代号：${identity}。` : "链上代号未取到。",
          token.totalSupplyDisplay
            ? `totalSupply：${token.totalSupplyDisplay}（原始值 ${token.totalSupplyRaw}）。`
            : "totalSupply 未取到。",
          "持有人分布、历史转账、集中度和发行方权益都还是缺口。",
          NOT_ADVICE,
        ].join(""),
      )

  const overview = section(
    "project_overview",
    "gap",
    "缺口：没有接入项目介绍或发行文件。链上名称不能当作项目概览。",
  )

  const issuer = section(
    "issuer_asset_structure",
    "gap",
    `缺口：没有发行方披露，也没有法定权益来源。${RIGHTS_DISTINCTION}`,
  )

  const contract = !token
    ? section("token_contract", "gap", input.failure ?? "缺口：这次没有读到合约。")
    : section(
        "token_contract",
        token.isContract === false ? "gap" : "observed",
        [
          `地址 ${token.address}，链 ${token.chainLabel}（${token.chainId}）。`,
          token.isContract === true
            ? "运行时代码非空。"
            : token.isContract === false
              ? "运行时代码为空，不把它当成代币合约。"
              : "未能确认运行时代码。",
          token.name ? `name=${token.name}。` : "name 未取到。",
          token.symbol ? `symbol=${token.symbol}。` : "symbol 未取到。",
          token.decimals !== null ? `decimals=${token.decimals}。` : "decimals 未取到。",
          token.implementationHint
            ? `可核验提示：EIP-1967 实现槽指向 ${token.implementationHint}。这只是存储槽里的地址，不是发行方身份，也不是权益结论。`
            : "EIP-1967 实现槽没有读到非零地址。这不证明它不是代理。",
        ].join(""),
      )

  const cross = section(
    "cross_chain",
    "gap",
    `${chainSummary}。未接入的链这次没有调用。标成未核验的链只表示代码可以发 RPC，不表示这次或预览环境已经读通。本次只读取了请求中的一条链，没有把其他地址自动认成同一资产，也没有做全链扫描。`,
  )

  const holders = section(
    "holder_distribution",
    "gap",
    "缺口：没有持有人索引。RPC 不能给出完整持有人历史或分布，本节没有持有人列表，也没有排名。",
  )

  const supply = !token || !token.totalSupplyRaw
    ? section(
        "supply_transfers",
        "gap",
        "缺口：totalSupply 未取到。历史转账与资金流没有索引数据源，没有转账列表。",
      )
    : section(
        "supply_transfers",
        "partial",
        `只取到 totalSupply ${token.totalSupplyDisplay ?? token.totalSupplyRaw}（原始值 ${token.totalSupplyRaw}）。历史转账、大额转账和资金流未接入索引，没有转账列表，也不做资金流结论。`,
      )

  const concentration = token?.holderShare
    ? section(
        "concentration",
        "partial",
        `只观测了地址 ${token.holderAddress} 相对 totalSupply 的比例：${token.holderShare}（余额原始值 ${token.holderBalanceRaw}）。这不是排名。Top1 / Top5 / Top10 未计算。`,
      )
    : section(
        "concentration",
        "gap",
        "缺口：没有完整持有人集合。Top1 / Top5 / Top10 未计算。未提供可核验的单个地址时，也不计算占比。",
      )

  const risks = section(
    "risk_factors",
    "gap",
    `不输出风险评分、概率或等级。当前能指出的是数据边界：持有人、转账、发行方披露和法定权益都未接入。${NOT_ADVICE}`,
  )

  const sources = section(
    "data_sources_limitations",
    token ? "partial" : "gap",
    [
      token
        ? `来源：Alchemy JSON-RPC（${token.endpoint}），链 ${token.chainLabel}，区块 ${token.blockNumber ?? "未取到"}，区块时间 ${token.blockTime ?? "未取到"}，抓取 ${token.fetchedAt}。`
        : "这次没有成功的链上读取。",
      token && token.unknown.length > 0 ? `未取到：${token.unknown.join("、")}。` : "",
      input.persistenceNote,
      "付款状态：未付款。本结果不代表已经收款。",
      input.persisted ? "本次读取已写入开发库中的研究记录。" : "",
      NOT_ADVICE,
    ]
      .filter(Boolean)
      .join(""),
  )

  return {
    sections: [executive, overview, issuer, contract, cross, holders, supply, concentration, risks, sources],
    paymentStatus: "unpaid",
    disclaimer: `${RIGHTS_DISTINCTION}${NOT_ADVICE}`,
  }
}
