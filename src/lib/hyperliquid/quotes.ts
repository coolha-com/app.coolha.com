import type { QuoteRouteFill, QuoteSummary, ZeroExMonetizationConfig } from './types'

const ZEROX_BASE_URL = 'https://api.0x.org'
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const MAX_SWAP_FEE_BPS = 1000

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
      token?: string
    }
  }
  route?: {
    fills?: ZeroExRouteFill[]
  }
}

type ZeroExMonetizationInput = {
  affiliateAddress?: string
  swapFeeRecipient?: string
  swapFeeBps?: string
}

function buildHeaders(apiKey?: string): HeadersInit {
  return {
    '0x-version': 'v2',
    ...(apiKey ? { '0x-api-key': apiKey } : {}),
  }
}

function isAddress(value: string | undefined): value is `0x${string}` {
  return Boolean(value && ADDRESS_PATTERN.test(value))
}

function normalizeAddress(value: string | undefined): `0x${string}` | undefined {
  const trimmed = value?.trim()

  return isAddress(trimmed) ? trimmed : undefined
}

function normalizeSwapFeeBps(value: string | undefined): string | undefined {
  const trimmed = value?.trim()

  if (!trimmed) {
    return undefined
  }

  const parsed = Number.parseInt(trimmed, 10)

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_SWAP_FEE_BPS) {
    return undefined
  }

  return String(parsed)
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

export function resolveZeroExMonetizationConfig(input: ZeroExMonetizationInput): ZeroExMonetizationConfig {
  const affiliateAddress = normalizeAddress(input.affiliateAddress)
  const swapFeeRecipient = normalizeAddress(input.swapFeeRecipient)
  const swapFeeBps = normalizeSwapFeeBps(input.swapFeeBps)
  const hasFeeInput = Boolean(input.swapFeeRecipient?.trim() || input.swapFeeBps?.trim())

  if (swapFeeRecipient && swapFeeBps) {
    return {
      affiliateAddress,
      swapFeeRecipient,
      swapFeeBps,
      feeEnabled: true,
      feeStatusLabel: `Builder Fee 已配置为 ${swapFeeBps} Bps，并会转发到平台收款地址。`,
    }
  }

  if (hasFeeInput) {
    return {
      affiliateAddress,
      feeEnabled: false,
      feeStatusLabel: 'Builder Fee 配置不完整或无效，本次 0x 请求不会附加平台费。',
    }
  }

  return {
    affiliateAddress,
    feeEnabled: false,
    feeStatusLabel: 'Builder Fee 尚未配置，当前请求仅用于报价，不附带平台费。',
  }
}

export function applyZeroExMonetizationParams(
  params: URLSearchParams,
  config: ZeroExMonetizationConfig,
): URLSearchParams {
  if (config.affiliateAddress) {
    params.set('affiliateAddress', config.affiliateAddress)
  }

  if (config.feeEnabled && config.swapFeeRecipient && config.swapFeeBps) {
    params.set('swapFeeRecipient', config.swapFeeRecipient)
    params.set('swapFeeBps', config.swapFeeBps)
  }

  return params
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
    integratorFeeToken: payload.fees?.integratorFee?.token,
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
