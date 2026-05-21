'use client'

import { useAppKit } from '@reown/appkit/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatUnits, parseUnits } from 'viem'
import { useAccount, usePublicClient, useSwitchChain, useWalletClient, useWriteContract } from 'wagmi'

import { AiInsightPanel } from '@/components/hyperliquid/AiInsightPanel'
import { QuoteDetails } from '@/components/hyperliquid/QuoteDetails'
import { SwapCard } from '@/components/hyperliquid/SwapCard'
import { TradingViewPanel } from '@/components/hyperliquid/TradingViewPanel'
import ConnectButton from '@/components/web3/ConnectButton'
import { Button } from '@/components/ui/button'
import { approvalState, buildApproveRequest } from '@/lib/hyperliquid/allowance'
import { buildTradeInsight } from '@/lib/hyperliquid/ai-explainer'
import { readAllTokenBalances, readNativeHypeBalance } from '@/lib/hyperliquid/balances'
import { HYPEREVM_CHAIN_ID } from '@/lib/hyperliquid/chains'
import {
  applyZeroExMonetizationParams,
  fetchPrice,
  fetchQuote,
  normalizePriceResponse,
  resolveZeroExMonetizationConfig,
} from '@/lib/hyperliquid/quotes'
import { evaluateTradeRisk } from '@/lib/hyperliquid/risk-engine'
import { sendSwapTransaction } from '@/lib/hyperliquid/swaps'
import {
  getTokenBySymbol,
  getZeroExTokenIdentifier,
  hasVerifiedTokenAddress,
  HYPEREVM_TOKENS,
} from '@/lib/hyperliquid/tokens'
import { waitForTransactionAndRefresh } from '@/lib/hyperliquid/transactions'
import type { QuoteSummary, RiskFlag, TokenSymbol, TradeInsight } from '@/lib/hyperliquid/types'

type QuoteState = 'idle' | 'loading' | 'ready' | 'error'
type TradeState = 'idle' | 'ready-to-approve' | 'approving' | 'ready-to-swap' | 'swapping' | 'pending' | 'success' | 'error'

type MarketOption = {
  id: string
  label: string
  buySymbol: TokenSymbol
  sellSymbol: TokenSymbol
  changeLabel: string
}

const DEFAULT_SLIPPAGE_BPS = 100
const MIN_HYPE_GAS_BALANCE = 0.02
const ZEROX_API_KEY = process.env.NEXT_PUBLIC_ZEROX_API_KEY?.trim()
const ZEROX_AFFILIATE_ADDRESS = process.env.NEXT_PUBLIC_ZEROX_AFFILIATE_ADDRESS?.trim()
const ZEROX_SWAP_FEE_RECIPIENT = process.env.NEXT_PUBLIC_ZEROX_SWAP_FEE_RECIPIENT?.trim()
const ZEROX_SWAP_FEE_BPS = process.env.NEXT_PUBLIC_ZEROX_SWAP_FEE_BPS?.trim()

const MARKET_OPTIONS: MarketOption[] = [
  {
    id: 'usdc-to-hype',
    label: 'USDC -> HYPE',
    buySymbol: 'HYPE',
    sellSymbol: 'USDC',
    changeLabel: 'live',
  },
  {
    id: 'hype-to-usdc',
    label: 'HYPE -> USDC',
    buySymbol: 'USDC',
    sellSymbol: 'HYPE',
    changeLabel: 'live',
  },
  {
    id: 'usdt0-to-hype',
    label: 'USDT0 -> HYPE',
    buySymbol: 'HYPE',
    sellSymbol: 'USDT0',
    changeLabel: 'live',
  },
  {
    id: 'hype-to-usdt0',
    label: 'HYPE -> USDT0',
    buySymbol: 'USDT0',
    sellSymbol: 'HYPE',
    changeLabel: 'live',
  },
]

function findReverseMarketId(marketId: string): string | null {
  const active = MARKET_OPTIONS.find((market) => market.id === marketId)

  if (!active) {
    return null
  }

  const reverse = MARKET_OPTIONS.find(
    (market) => market.sellSymbol === active.buySymbol && market.buySymbol === active.sellSymbol,
  )

  return reverse?.id ?? null
}

function formatDisplayValue(value?: string, maximumFractionDigits = 4): string {
  if (!value) {
    return '--'
  }

  const numeric = Number.parseFloat(value)
  if (Number.isNaN(numeric)) {
    return value
  }

  return numeric.toLocaleString('en-US', {
    maximumFractionDigits,
  })
}

function formatAddressLike(address?: string): string {
  if (!address) {
    return 'Not connected'
  }

  if (!address.startsWith('0x') || address.length < 10) {
    return address
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatQuoteAmount(rawAmount: string | undefined, symbol: TokenSymbol): string {
  if (!rawAmount) {
    return '--'
  }

  const token = getTokenBySymbol(symbol)
  if (!token) {
    return rawAmount
  }

  try {
    return formatDisplayValue(formatUnits(BigInt(rawAmount), token.decimals), 6)
  } catch {
    return rawAmount
  }
}

function getTokenByReference(reference?: string) {
  if (!reference) {
    return undefined
  }

  const bySymbol = getTokenBySymbol(reference)
  if (bySymbol) {
    return bySymbol
  }

  const normalizedReference = reference.toLowerCase()
  return HYPEREVM_TOKENS.find(
    (token) => token.address !== 'native' && token.address.toLowerCase() === normalizedReference,
  )
}

function formatIntegratorFeeAmount(
  rawAmount: string | undefined,
  feeTokenReference: string | undefined,
  fallbackSymbol: TokenSymbol,
): string {
  if (!rawAmount || rawAmount === '0') {
    return '0'
  }

  const token = getTokenByReference(feeTokenReference) ?? getTokenBySymbol(fallbackSymbol)
  if (!token) {
    return rawAmount
  }

  try {
    return formatDisplayValue(formatUnits(BigInt(rawAmount), token.decimals), 6)
  } catch {
    return rawAmount
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected error'
}

export default function AiPage() {
  const { open } = useAppKit()
  const { address, chainId, isConnected } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()

  const [activeMarketId, setActiveMarketId] = useState(MARKET_OPTIONS[0].id)
  const [amount, setAmount] = useState('')
  const [balances, setBalances] = useState<Partial<Record<TokenSymbol, string>> | null>(null)
  const [gasBalance, setGasBalance] = useState<string | null>(null)
  const [quote, setQuote] = useState<QuoteSummary | null>(null)
  const [quoteState, setQuoteState] = useState<QuoteState>('idle')
  const [tradeState, setTradeState] = useState<TradeState>('idle')
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [quoteUpdatedAt, setQuoteUpdatedAt] = useState<string | null>(null)
  const [approvalRequired, setApprovalRequired] = useState(false)
  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([])
  const [insight, setInsight] = useState<TradeInsight>(
    buildTradeInsight({
      sellSymbol: MARKET_OPTIONS[0].sellSymbol,
      buySymbol: MARKET_OPTIONS[0].buySymbol,
      receiveAmount: '0',
      riskLevel: 'low',
      riskFlags: [],
    }),
  )

  const activeMarket = useMemo(
    () => MARKET_OPTIONS.find((market) => market.id === activeMarketId) ?? MARKET_OPTIONS[0],
    [activeMarketId],
  )
  const reverseMarketId = useMemo(() => findReverseMarketId(activeMarketId), [activeMarketId])
  const monetizationConfig = useMemo(
    () =>
      resolveZeroExMonetizationConfig({
        affiliateAddress: ZEROX_AFFILIATE_ADDRESS,
        swapFeeRecipient: ZEROX_SWAP_FEE_RECIPIENT,
        swapFeeBps: ZEROX_SWAP_FEE_BPS,
      }),
    [],
  )
  const sellToken = useMemo(() => getTokenBySymbol(activeMarket.sellSymbol), [activeMarket.sellSymbol])
  const buyToken = useMemo(() => getTokenBySymbol(activeMarket.buySymbol), [activeMarket.buySymbol])
  const isCorrectChain = chainId === HYPEREVM_CHAIN_ID
  const hasEnoughGas = Number.parseFloat(gasBalance ?? '0') >= MIN_HYPE_GAS_BALANCE
  const sellTokenAddressVerified = hasVerifiedTokenAddress(activeMarket.sellSymbol)
  const isBusy =
    quoteState === 'loading' ||
    tradeState === 'approving' ||
    tradeState === 'swapping' ||
    tradeState === 'pending'

  const parsedAmount = useMemo(() => {
    if (!sellToken || !amount.trim()) {
      return null
    }

    try {
      return parseUnits(amount, sellToken.decimals)
    } catch {
      return null
    }
  }, [amount, sellToken])

  const resetFlow = useCallback(() => {
    setQuote(null)
    setQuoteState('idle')
    setTradeState('idle')
    setQuoteError(null)
    setQuoteUpdatedAt(null)
    setApprovalRequired(false)
    setRiskFlags([])
    setInsight(
      buildTradeInsight({
        sellSymbol: activeMarket.sellSymbol,
        buySymbol: activeMarket.buySymbol,
        receiveAmount: '0',
        riskLevel: 'low',
        riskFlags: [],
      }),
    )
  }, [activeMarket.buySymbol, activeMarket.sellSymbol])

  const handleSwapDirection = useCallback(() => {
    if (!reverseMarketId) {
      return
    }

    setActiveMarketId(reverseMarketId)
  }, [reverseMarketId])

  const refreshBalances = useCallback(async () => {
    if (!publicClient || !address || !isConnected || !isCorrectChain) {
      setBalances(null)
      setGasBalance(null)
      return
    }

    const [nextBalances, nextGasBalance] = await Promise.all([
      readAllTokenBalances(publicClient, address),
      readNativeHypeBalance(publicClient, address),
    ])

    setBalances(nextBalances)
    setGasBalance(nextGasBalance)
  }, [address, isConnected, isCorrectChain, publicClient])

  const buildQuoteParams = useCallback(
    () => {
      if (!ZEROX_API_KEY) {
        throw new Error('缺少 NEXT_PUBLIC_ZEROX_API_KEY，当前无法请求报价。')
      }

      if (!sellToken || !buyToken) {
        throw new Error('当前交易对缺少代币元数据。')
      }

      const sellTokenIdentifier = getZeroExTokenIdentifier(activeMarket.sellSymbol)
      const buyTokenIdentifier = getZeroExTokenIdentifier(activeMarket.buySymbol)

      if (!sellTokenIdentifier || !buyTokenIdentifier) {
        throw new Error('当前交易对缺少有效的 0x token 标识。')
      }

      if (!address || !parsedAmount || parsedAmount <= 0n) {
        throw new Error('请先输入有效数量，再请求报价。')
      }

      const params = new URLSearchParams({
        chainId: String(HYPEREVM_CHAIN_ID),
        sellToken: sellTokenIdentifier,
        buyToken: buyTokenIdentifier,
        sellAmount: parsedAmount.toString(),
        slippageBps: String(DEFAULT_SLIPPAGE_BPS),
        taker: address,
      })

      return applyZeroExMonetizationParams(params, monetizationConfig)
    },
    [activeMarket.buySymbol, activeMarket.sellSymbol, address, buyToken, monetizationConfig, parsedAmount, sellToken],
  )

  useEffect(() => {
    resetFlow()
  }, [amount, activeMarketId, resetFlow])

  useEffect(() => {
    let cancelled = false

    async function loadBalances() {
      try {
        await refreshBalances()
      } catch (error) {
        if (!cancelled) {
          setGasBalance(null)
          setBalances(null)
          setQuoteError(toErrorMessage(error))
        }
      }
    }

    loadBalances()

    return () => {
      cancelled = true
    }
  }, [refreshBalances])

  const handleGetQuote = useCallback(async () => {
    if (!publicClient || !address || !sellToken || !buyToken || !parsedAmount || parsedAmount <= 0n) {
      setQuoteError('请先连接 HyperEVM 钱包并输入有效数量。')
      setQuoteState('error')
      return
    }

    try {
      setQuoteError(null)
      setQuoteState('loading')
      setTradeState('idle')

      const payload = await fetchPrice(buildQuoteParams(), ZEROX_API_KEY)
      const normalizedQuote = normalizePriceResponse(payload as Parameters<typeof normalizePriceResponse>[0])
      const nextRisk = evaluateTradeRisk({
        hasEnoughGas,
        priceImpactBps: 40,
        slippageBps: DEFAULT_SLIPPAGE_BPS,
      })

      let shouldApprove = false
      if (normalizedQuote.allowanceTarget && sellToken.address !== 'native') {
        const approval = await approvalState(
          publicClient,
          address,
          normalizedQuote.allowanceTarget,
          sellToken.symbol,
          parsedAmount,
        )
        shouldApprove = approval.approvalRequired
      }

      setQuote(normalizedQuote)
      setQuoteState('ready')
      setTradeState(shouldApprove ? 'ready-to-approve' : 'ready-to-swap')
      setApprovalRequired(shouldApprove)
      setRiskFlags(nextRisk.flags)
      setQuoteUpdatedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
      setInsight(
        buildTradeInsight({
          sellSymbol: activeMarket.sellSymbol,
          buySymbol: activeMarket.buySymbol,
          receiveAmount: formatQuoteAmount(normalizedQuote.buyAmount, activeMarket.buySymbol),
          riskLevel: nextRisk.level,
          riskFlags: nextRisk.flags,
        }),
      )
    } catch (error) {
      setQuote(null)
      setQuoteState('error')
      setTradeState('error')
      setApprovalRequired(false)
      setRiskFlags([])
      setQuoteError(toErrorMessage(error))
    }
  }, [activeMarket.buySymbol, activeMarket.sellSymbol, address, buildQuoteParams, buyToken, hasEnoughGas, parsedAmount, publicClient, sellToken])

  const handleApprove = useCallback(async () => {
    if (!publicClient || !quote?.allowanceTarget || !sellToken || sellToken.address === 'native') {
      setApprovalRequired(false)
      setTradeState('ready-to-swap')
      return
    }

    try {
      setTradeState('approving')
      const hash = await writeContractAsync(buildApproveRequest(sellToken.address, quote.allowanceTarget))
      await waitForTransactionAndRefresh(publicClient, hash, refreshBalances)
      setApprovalRequired(false)
      setTradeState('ready-to-swap')
    } catch (error) {
      setTradeState('error')
      setQuoteError(toErrorMessage(error))
    }
  }, [publicClient, quote?.allowanceTarget, refreshBalances, sellToken, writeContractAsync])

  const handleSwap = useCallback(async () => {
    if (!walletClient || !publicClient) {
      setTradeState('error')
      setQuoteError('钱包客户端不可用。')
      return
    }

    try {
      setTradeState('swapping')
      const payload = await fetchQuote(buildQuoteParams(), ZEROX_API_KEY)
      const hash = await sendSwapTransaction(walletClient, payload as Parameters<typeof sendSwapTransaction>[1])

      setTradeState('pending')
      await waitForTransactionAndRefresh(publicClient, hash, refreshBalances)
      setTradeState('success')
      await handleGetQuote()
    } catch (error) {
      setTradeState('error')
      setQuoteError(toErrorMessage(error))
    }
  }, [buildQuoteParams, handleGetQuote, publicClient, refreshBalances, walletClient])

  const handlePrimaryAction = useCallback(async () => {
    if (!isConnected) {
      open({ view: 'Connect', namespace: 'eip155' })
      return
    }

    if (!isCorrectChain) {
      await switchChainAsync({ chainId: HYPEREVM_CHAIN_ID })
      return
    }

    if (!parsedAmount || parsedAmount <= 0n) {
      return
    }

    if (!quote || quoteState !== 'ready') {
      await handleGetQuote()
      return
    }

    if (approvalRequired) {
      await handleApprove()
      return
    }

    await handleSwap()
  }, [
    approvalRequired,
    handleApprove,
    handleGetQuote,
    handleSwap,
    isConnected,
    isCorrectChain,
    open,
    parsedAmount,
    quote,
    quoteState,
    switchChainAsync,
  ])

  const primaryLabel = useMemo(() => {
    if (!isConnected) {
      return '连接钱包'
    }

    if (!isCorrectChain) {
      return '切换到 HyperEVM'
    }

    if (!parsedAmount || parsedAmount <= 0n) {
      return '输入数量'
    }

    if (!ZEROX_API_KEY) {
      return '配置 0x API Key'
    }

    if (quoteState === 'loading') {
      return '获取报价中...'
    }

    if (tradeState === 'approving') {
      return '授权中...'
    }

    if (approvalRequired) {
      return '授权代币'
    }

    if (tradeState === 'swapping' || tradeState === 'pending') {
      return '提交交易中...'
    }

    if (tradeState === 'success') {
      return '交易已完成'
    }

    if (quoteState === 'ready') {
      return '立即兑换'
    }

    return '获取报价'
  }, [approvalRequired, isConnected, isCorrectChain, parsedAmount, quoteState, tradeState])

  const statusLabel = useMemo(() => {
    if (!isConnected) {
      return '钱包未连接'
    }

    if (!isCorrectChain) {
      return '请先切换到 HyperEVM 主网。'
    }

    if (!ZEROX_API_KEY) {
      return '缺少 NEXT_PUBLIC_ZEROX_API_KEY，报价和交易暂不可用。'
    }

    if (!sellTokenAddressVerified) {
      return '当前卖出代币地址尚未在本地完成校验，此交易对暂不可用。'
    }

    if (quoteError) {
      return quoteError
    }

    if (tradeState === 'success') {
      return '交易已在链上确认。'
    }

    if (tradeState === 'pending') {
      return '等待链上确认中。'
    }

    if (approvalRequired) {
      return '兑换前需要先完成代币授权。'
    }

    if (quoteState === 'ready') {
      return '报价已就绪，请确认路由和手续费。'
    }

    return '输入数量后即可请求最新报价。'
  }, [approvalRequired, isConnected, isCorrectChain, quoteError, quoteState, sellTokenAddressVerified, tradeState])

  const quotePreview = quote
    ? `预计到账 ${formatQuoteAmount(quote.buyAmount, activeMarket.buySymbol)} ${activeMarket.buySymbol}`
    : '尚未请求报价'
  const integratorFeeLabel = useMemo(() => {
    if (!quote) {
      return monetizationConfig.feeEnabled ? '等待报价' : '未配置'
    }

    if (quote.integratorFeeAmount === '0') {
      return monetizationConfig.feeEnabled ? '该路由未返回 Builder Fee' : '当前未附加平台费'
    }

    const formattedAmount = formatIntegratorFeeAmount(
      quote.integratorFeeAmount,
      quote.integratorFeeToken,
      activeMarket.buySymbol,
    )
    const feeTokenLabel =
      getTokenByReference(quote.integratorFeeToken)?.symbol ??
      (quote.integratorFeeToken ? formatAddressLike(quote.integratorFeeToken) : activeMarket.buySymbol)

    return `${formattedAmount} ${feeTokenLabel}`
  }, [activeMarket.buySymbol, monetizationConfig.feeEnabled, quote])

  const marketItems = MARKET_OPTIONS

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(144,137,252,0.14),_transparent_34%),linear-gradient(180deg,_rgba(10,10,18,0.95),_rgba(10,10,18,1))] px-4 py-6">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Swap</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">HyperEVM 现货兑换</h1>
        </div>
        <ConnectButton />
      </div>

      <main className="mx-auto mt-8 flex w-full max-w-6xl justify-center">
        <section className="w-full max-w-2xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {marketItems.map((market) => (
              <Button
                className="rounded-full"
                key={market.id}
                onClick={() => setActiveMarketId(market.id)}
                size="sm"
                type="button"
                variant={activeMarketId === market.id ? 'secondary' : 'outline'}
              >
                {market.label}
              </Button>
            ))}
          </div>

          <div className="rounded-[2rem] border border-border/60 bg-card/60 p-4 shadow-none backdrop-blur">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="rounded-full border border-border/70 px-3 py-1">
                  {!isConnected ? '钱包未连接' : isCorrectChain ? 'HyperEVM' : `错误网络 ${chainId ?? '--'}`}
                </span>
                <span className="rounded-full border border-border/70 px-3 py-1">
                  {!isConnected
                    ? '请先连接钱包'
                    : gasBalance
                      ? `${formatDisplayValue(gasBalance)} HYPE${hasEnoughGas ? '' : ' Gas 偏低'}`
                      : 'Gas 加载中'}
                </span>
                {isConnected ? (
                  <span className="rounded-full border border-border/70 px-3 py-1">{formatAddressLike(address)}</span>
                ) : null}
              </div>
              <span className="text-xs text-muted-foreground">仅自托管</span>
            </div>

            <SwapCard
              amount={amount}
              balanceLabel={
                balances?.[activeMarket.sellSymbol]
                  ? `${formatDisplayValue(balances[activeMarket.sellSymbol])} ${activeMarket.sellSymbol}`
                  : sellTokenAddressVerified
                    ? '余额暂不可用'
                    : '地址待校验'
              }
              isConnected={isConnected}
              isPrimaryDisabled={isBusy || (isConnected && isCorrectChain && (!parsedAmount || parsedAmount <= 0n || !ZEROX_API_KEY))}
              onAmountChange={setAmount}
              onPrimaryAction={() => {
                void handlePrimaryAction()
              }}
              onSwapDirection={() => {
                void handleSwapDirection()
              }}
              primaryLabel={primaryLabel}
              quotePreview={quotePreview}
              sellSymbol={activeMarket.sellSymbol}
              statusLabel={statusLabel}
              buySymbol={activeMarket.buySymbol}
              isSwapDirectionDisabled={!reverseMarketId || isBusy}
            />

            <div className="mt-4">
              <QuoteDetails
                buyAmount={quote ? `${formatQuoteAmount(quote.buyAmount, activeMarket.buySymbol)} ${activeMarket.buySymbol}` : '--'}
                feeConfigLabel={monetizationConfig.feeStatusLabel}
                integratorFeeAmount={integratorFeeLabel}
                minBuyAmount={quote ? `${formatQuoteAmount(quote.minBuyAmount, activeMarket.buySymbol)} ${activeMarket.buySymbol}` : '--'}
                routeSummary={quote?.routeSummary}
                statusLabel={quoteError ? `报价错误：${quoteError}` : quoteUpdatedAt ? `上次更新：${quoteUpdatedAt}` : '等待报价'}
              />
            </div>
          </div>

          <details className="group rounded-[1.75rem] border border-border/60 bg-card/60 p-4 backdrop-blur">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
              <span>AI 解读</span>
              <span className="text-xs text-muted-foreground group-open:hidden">展开</span>
              <span className="hidden text-xs text-muted-foreground group-open:inline">收起</span>
            </summary>
            <div className="mt-4">
              <AiInsightPanel
                riskItems={riskFlags}
                statusLabel={statusLabel}
                suggestion={insight.suggestion}
                summary={insight.summary}
                warning={insight.warning}
                disclaimerLabel="AI 输出仅用于描述和风险解释，不构成投资建议，也不承诺收益或成交质量。"
              />
            </div>
          </details>

          <details className="group rounded-[1.75rem] border border-border/60 bg-card/60 p-4 backdrop-blur">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
              <span>K 线图</span>
              <span className="text-xs text-muted-foreground group-open:hidden">展开</span>
              <span className="hidden text-xs text-muted-foreground group-open:inline">收起</span>
            </summary>
            <div className="mt-4">
              <TradingViewPanel pairLabel={activeMarket.label} />
            </div>
          </details>

          <section className="rounded-[1.75rem] border border-dashed border-border/80 bg-card/50 p-4 text-sm leading-7 text-muted-foreground">
            这是一个自托管兑换界面。报价来自前端直连的 0x 集成，每一笔交易仍需你在钱包中亲自确认，Builder Fee 是否生效取决于你的 0x 配置与具体路由。
          </section>

          <section className="grid gap-2 sm:grid-cols-2">
            {HYPEREVM_TOKENS.filter((token) => ['HYPE', 'USDC', 'USDT0'].includes(token.symbol)).map((token) => (
              <div className="rounded-[1.25rem] border border-border/60 bg-card/50 px-4 py-3 text-sm" key={token.symbol}>
                <p className="font-medium text-foreground">{token.symbol}</p>
                <p className="mt-1 text-muted-foreground">
                  {balances?.[token.symbol]
                    ? `${formatDisplayValue(balances[token.symbol])} ${token.symbol}`
                    : token.isAddressVerified
                      ? '余额加载中'
                      : '地址待校验'}
                </p>
              </div>
            ))}
          </section>
        </section>
      </main>
    </div>
  )
}
