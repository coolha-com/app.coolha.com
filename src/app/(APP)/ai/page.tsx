'use client'

import { useAppKit } from '@reown/appkit/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatUnits, parseUnits, type Address } from 'viem'
import { useAccount, usePublicClient, useSwitchChain, useWalletClient, useWriteContract } from 'wagmi'

import { AiInsightPanel } from '@/components/hyperliquid/AiInsightPanel'
import { MarketList } from '@/components/hyperliquid/MarketList'
import { QuoteDetails } from '@/components/hyperliquid/QuoteDetails'
import { SwapCard } from '@/components/hyperliquid/SwapCard'
import { TradingViewPanel } from '@/components/hyperliquid/TradingViewPanel'
import { WalletStatusBar } from '@/components/hyperliquid/WalletStatusBar'
import ConnectButton from '@/components/web3/ConnectButton'
import { approvalState, buildApproveRequest } from '@/lib/hyperliquid/allowance'
import { buildTradeInsight } from '@/lib/hyperliquid/ai-explainer'
import { readAllTokenBalances, readNativeHypeBalance } from '@/lib/hyperliquid/balances'
import { HYPEREVM_CHAIN_ID } from '@/lib/hyperliquid/chains'
import { fetchPrice, fetchQuote, normalizePriceResponse } from '@/lib/hyperliquid/quotes'
import { evaluateTradeRisk } from '@/lib/hyperliquid/risk-engine'
import { sendSwapTransaction } from '@/lib/hyperliquid/swaps'
import { HYPEREVM_TOKENS, getTokenBySymbol } from '@/lib/hyperliquid/tokens'
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
const ZEROX_API_KEY = process.env.NEXT_PUBLIC_ZEROX_API_KEY

const MARKET_OPTIONS: MarketOption[] = [
  { id: 'hype-usdc', label: 'HYPE / USDC', buySymbol: 'HYPE', sellSymbol: 'USDC', changeLabel: '+2.8%' },
  { id: 'eth-usdc', label: 'ETH / USDC', buySymbol: 'ETH', sellSymbol: 'USDC', changeLabel: '+1.2%' },
  { id: 'btc-usdc', label: 'BTC / USDC', buySymbol: 'BTC', sellSymbol: 'USDC', changeLabel: '+0.7%' },
  { id: 'usdt0-hype', label: 'USDT0 / HYPE', buySymbol: 'USDT0', sellSymbol: 'HYPE', changeLabel: '-0.3%' },
]

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

function formatAddress(address?: Address): string {
  if (!address) {
    return 'Not connected'
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
  const [balances, setBalances] = useState<Record<TokenSymbol, string> | null>(null)
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
  const sellToken = useMemo(() => getTokenBySymbol(activeMarket.sellSymbol), [activeMarket.sellSymbol])
  const buyToken = useMemo(() => getTokenBySymbol(activeMarket.buySymbol), [activeMarket.buySymbol])
  const isCorrectChain = chainId === HYPEREVM_CHAIN_ID
  const hasEnoughGas = Number.parseFloat(gasBalance ?? '0') >= MIN_HYPE_GAS_BALANCE
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
      if (!address || !parsedAmount || parsedAmount <= 0n) {
        throw new Error('Enter a valid amount before requesting a quote.')
      }

      const params = new URLSearchParams({
        chainId: String(HYPEREVM_CHAIN_ID),
        sellToken: activeMarket.sellSymbol,
        buyToken: activeMarket.buySymbol,
        sellAmount: parsedAmount.toString(),
        slippageBps: String(DEFAULT_SLIPPAGE_BPS),
        taker: address,
      })

      if (ZEROX_API_KEY) {
        params.set('affiliateAddress', address)
      }

      return params
    },
    [activeMarket.buySymbol, activeMarket.sellSymbol, address, parsedAmount],
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
      setQuoteError('Enter a valid amount and connect to HyperEVM first.')
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
      setQuoteError('Wallet client is not available.')
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
      return 'Connect Wallet'
    }

    if (!isCorrectChain) {
      return 'Switch To HyperEVM'
    }

    if (!parsedAmount || parsedAmount <= 0n) {
      return 'Enter Amount'
    }

    if (quoteState === 'loading') {
      return 'Getting Quote...'
    }

    if (tradeState === 'approving') {
      return 'Approving...'
    }

    if (approvalRequired) {
      return 'Approve Token'
    }

    if (tradeState === 'swapping' || tradeState === 'pending') {
      return 'Submitting Swap...'
    }

    if (tradeState === 'success') {
      return 'Swap Completed'
    }

    if (quoteState === 'ready') {
      return 'Swap Now'
    }

    return 'Get Quote'
  }, [approvalRequired, isConnected, isCorrectChain, parsedAmount, quoteState, tradeState])

  const statusLabel = useMemo(() => {
    if (!isConnected) {
      return 'Wallet disconnected'
    }

    if (!isCorrectChain) {
      return 'Switch to HyperEVM mainnet to continue.'
    }

    if (quoteError) {
      return quoteError
    }

    if (tradeState === 'success') {
      return 'Swap settled on-chain.'
    }

    if (tradeState === 'pending') {
      return 'Waiting for the transaction confirmation.'
    }

    if (approvalRequired) {
      return 'Allowance approval is required before swapping.'
    }

    if (quoteState === 'ready') {
      return 'Quote ready. Review the route and confirm the trade.'
    }

    return 'Enter an amount to request a fresh quote.'
  }, [approvalRequired, isConnected, isCorrectChain, quoteError, quoteState, tradeState])

  const quotePreview = quote
    ? `Expected receive ${formatQuoteAmount(quote.buyAmount, activeMarket.buySymbol)} ${activeMarket.buySymbol}`
    : 'No quote requested yet'

  const marketItems = useMemo(
    () =>
      MARKET_OPTIONS.map((market) => ({
        id: market.id,
        label: market.label,
        changeLabel: market.changeLabel,
        subtitle: `${market.sellSymbol} -> ${market.buySymbol}`,
      })),
    [],
  )

  return (
    <div className="container mx-auto min-h-screen space-y-6 px-4 py-6">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">HyperEVM AI Terminal</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Trade whitelisted spot pairs with wallet-confirmed execution</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          The page keeps swap execution self-custodial, surfaces HyperEVM wallet readiness, and updates AI insight from the live quote state.
        </p>
      </div>

      <main className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <aside className="space-y-4">
          <div className="rounded-[2rem] border border-border/60 bg-card/90 p-4 shadow-none backdrop-blur">
            <p className="mb-3 text-sm font-medium text-foreground">Wallet Access</p>
            <ConnectButton />
          </div>
          <MarketList activeMarketId={activeMarketId} markets={marketItems} onSelectMarket={setActiveMarketId} />
        </aside>

        <section className="space-y-4">
          <WalletStatusBar
            addressLabel={formatAddress(address)}
            connectionLabel={isConnected ? 'Connected' : 'Disconnected'}
            gasLabel={
              !isConnected
                ? 'Connect to load HYPE balance'
                : !isCorrectChain
                  ? 'Switch to HyperEVM'
                  : gasBalance
                    ? `${formatDisplayValue(gasBalance)} HYPE${hasEnoughGas ? ' ready' : ' low'}`
                    : 'Loading HYPE balance...'
            }
            networkLabel={!isConnected ? 'Not connected' : isCorrectChain ? 'HyperEVM' : `Wrong network (${chainId ?? '--'})`}
          />
          <TradingViewPanel pairLabel={activeMarket.label} />
          <SwapCard
            amount={amount}
            balanceLabel={balances?.[activeMarket.sellSymbol] ? `${formatDisplayValue(balances[activeMarket.sellSymbol])} ${activeMarket.sellSymbol}` : 'Balance unavailable'}
            isConnected={isConnected}
            isPrimaryDisabled={isBusy || (isConnected && isCorrectChain && (!parsedAmount || parsedAmount <= 0n))}
            onAmountChange={setAmount}
            onPrimaryAction={() => {
              void handlePrimaryAction()
            }}
            primaryLabel={primaryLabel}
            quotePreview={quotePreview}
            sellSymbol={activeMarket.sellSymbol}
            statusLabel={statusLabel}
            buySymbol={activeMarket.buySymbol}
          />
          <QuoteDetails
            buyAmount={quote ? `${formatQuoteAmount(quote.buyAmount, activeMarket.buySymbol)} ${activeMarket.buySymbol}` : '--'}
            integratorFeeAmount={quote ? formatQuoteAmount(quote.integratorFeeAmount, activeMarket.sellSymbol) : '--'}
            minBuyAmount={quote ? `${formatQuoteAmount(quote.minBuyAmount, activeMarket.buySymbol)} ${activeMarket.buySymbol}` : '--'}
            routeSummary={quote?.routeSummary}
            statusLabel={quoteError ? `Quote error: ${quoteError}` : quoteUpdatedAt ? `Last updated ${quoteUpdatedAt}` : 'Awaiting quote'}
          />
        </section>

        <AiInsightPanel
          riskItems={riskFlags}
          statusLabel={statusLabel}
          suggestion={insight.suggestion}
          summary={insight.summary}
          warning={insight.warning}
        />
      </main>

      <section className="rounded-[2rem] border border-dashed border-border/80 bg-card/50 p-4 text-sm text-muted-foreground">
        All swaps stay self-custodial. Quotes come from the frontend 0x integration, and every approval or swap still requires your own wallet confirmation.
      </section>

      <section className="grid gap-3 md:grid-cols-5">
        {HYPEREVM_TOKENS.map((token) => (
          <div className="rounded-[2rem] border border-border/60 bg-card/70 px-4 py-3 text-sm" key={token.symbol}>
            <p className="font-medium text-foreground">{token.symbol}</p>
            <p className="mt-1 text-muted-foreground">
              {balances?.[token.symbol] ? `${formatDisplayValue(balances[token.symbol])} ${token.symbol}` : 'Balance pending'}
            </p>
          </div>
        ))}
      </section>
    </div>
  )
}
