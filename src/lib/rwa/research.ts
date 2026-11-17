import "server-only"

import { AlchemyError, isAlchemyConfigured } from "@/lib/alchemy/client"
import { readTokenObservation, ChainNotConnectedError } from "@/lib/rwa/onchain"
import { buildResearchReport, type ResearchReport, type TokenObservation } from "@/lib/rwa/report"
import { persistReport, persistTokenFacts } from "@/lib/rwa/store"

export interface ResearchResult {
  status: "live" | "not_configured" | "not_connected" | "invalid_request" | "upstream_error"
  message: string
  token: TokenObservation | null
  report: ResearchReport
}

export async function runRwaResearch(input: {
  chainKey: string
  address: string
  holder?: string | null
  subject?: string | null
}): Promise<ResearchResult> {
  if (!isAlchemyConfigured()) {
    const report = buildResearchReport({
      token: null,
      failure: "服务端未配置 Alchemy，本次没有链上数据。",
      persisted: false,
      persistenceNote: "未配置读取凭证，没有写入研究记录。",
    })
    return {
      status: "not_configured",
      message: "服务端未配置 Alchemy，本次没有链上数据。",
      token: null,
      report,
    }
  }

  try {
    const token = await readTokenObservation({
      chainKey: input.chainKey,
      address: input.address,
      holder: input.holder,
    })
    const saved = await persistTokenFacts(token)
    const report = buildResearchReport({
      token,
      failure: null,
      persisted: saved.persisted,
      persistenceNote: saved.note,
    })
    if (saved.persisted) {
      const reportSaved = await persistReport({
        token,
        report,
        subject: input.subject ?? null,
      })
      if (!reportSaved.persisted) {
        report.sections = buildResearchReport({
          token,
          failure: null,
          persisted: false,
          persistenceNote: `${saved.note} ${reportSaved.note}`,
        }).sections
      }
    }
    return {
      status: "live",
      message: "本次只包含实际取到的链上字段；标成缺口的章节没有数据。",
      token,
      report,
    }
  } catch (error) {
    if (error instanceof ChainNotConnectedError) {
      const invalid = error.message.includes("地址") || error.message.includes("address") || error.message.includes("holder")
      const report = buildResearchReport({
        token: null,
        failure: error.message,
        persisted: false,
        persistenceNote: "没有成功读取，没有写入研究记录。",
      })
      return {
        status: invalid ? "invalid_request" : "not_connected",
        message: error.message,
        token: null,
        report,
      }
    }
    const message =
      error instanceof AlchemyError
        ? error.message
        : error instanceof Error
          ? error.message
          : "链上读取失败"
    const report = buildResearchReport({
      token: null,
      failure: message,
      persisted: false,
      persistenceNote: "读取失败，没有写入研究记录。",
    })
    return { status: "upstream_error", message, token: null, report }
  }
}
