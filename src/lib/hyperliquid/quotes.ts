import type { QuoteRouteFill, QuoteSummary } from './types'

const ZEROX_BASE_URL = 'https://api.0x.org'

type ZeroExRouteFill = {
  from?: string
  to?: string
  source?: string
}

type ZeroExQuotePayload = {
  allowanceTarget?: string
  buyAmount?: string
  grossBuyAmount?: string
  minBuyAmount?: string
  sellAmount?: string
  fees?: {
    integratorFee?: {
      amount?: string
    }
  }
  route?: {
    fills?: ZeroExRouteFill[]
  }
}

function buildHeaders(apiKey?: string): HeadersInit {
  return {
    '0x-version': 'v2',
    ...(apiKey ? { '0x-api-key': apiKey } : {}),
  }
}

function buildUrl(pathname: string, params: URLSearchParams): string {
  return `${ZEROX_BASE_URL}${pathname}?${params.toString()}`
}

function toRouteFills(fills: ZeroExRouteFill[] | undefined): QuoteRouteFill[] | undefined {
  if (!fills?.length) {
    return undefined
  }

  return fills.map((fill) => ({
    fromSymbol: fill.from ?? '',
    toSymbol: fill.to ?? '',
    source: fill.source ?? 'Unknown',
  }))
}

function toRouteSummary(routeFills: QuoteRouteFill[] | undefined): string {
  if (!routeFills?.length) {
    return 'Direct'
  }

  return routeFills.map((fill) => fill.source).join(' > ')
}

async function fetchZeroExJson(pathname: string, params: URLSearchParams, apiKey?: string): Promise<unknown> {
  const response = await fetch(buildUrl(pathname, params), {
    headers: buildHeaders(apiKey),
  })

  if (!response.ok) {
    throw new Error(`0x request failed: ${response.status}`)
  }

  return response.json()
}

export function normalizePriceResponse(payload: ZeroExQuotePayload): QuoteSummary {
  const routeFills = toRouteFills(payload.route?.fills)

  return {
    allowanceTarget:
      payload.allowanceTarget?.startsWith('0x') ? (payload.allowanceTarget as `0x${string}`) : undefined,
    buyAmount: payload.buyAmount ?? '0',
    minBuyAmount: payload.minBuyAmount ?? payload.grossBuyAmount ?? payload.buyAmount ?? '0',
    sellAmount: payload.sellAmount ?? '0',
    integratorFeeAmount: payload.fees?.integratorFee?.amount ?? '0',
    routeSummary: toRouteSummary(routeFills),
    routeFills,
  }
}

export async function fetchPrice(params: URLSearchParams, apiKey?: string): Promise<unknown> {
  return fetchZeroExJson('/swap/allowance-holder/price', params, apiKey)
}

export async function fetchQuote(params: URLSearchParams, apiKey?: string): Promise<unknown> {
  return fetchZeroExJson('/swap/allowance-holder/quote', params, apiKey)
}
