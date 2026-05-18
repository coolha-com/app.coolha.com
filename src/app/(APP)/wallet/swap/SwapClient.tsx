'use client'

import { useMemo, useState } from 'react'
import { AppKit, BridgeChain } from '@circle-fin/app-kit'
import { ArcTestnet } from '@circle-fin/app-kit/chains'
import { ViemAdapter } from '@circle-fin/adapter-viem-v2'
import { arcTestnet } from '@reown/appkit/networks'
import { createPublicClient, http } from 'viem'
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi'
import ConnectButton from '@/components/web3/ConnectButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const kit = new AppKit()
const SUPPORTED_TOKENS = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    description: 'Arc Testnet 上最常用的测试稳定币。',
  },
  {
    symbol: 'EURC',
    name: 'Euro Coin',
    description: 'Arc Swap 官方示例里最常见的目标代币。',
  },
  {
    symbol: 'cirBTC',
    name: 'Circle BTC',
    description: 'Arc Testnet 上可用于测试交换的 BTC 资产。',
  },
] as const

const SLIPPAGE_OPTIONS = [
  { label: '1%', value: 100 },
  { label: '3%', value: 300 },
  { label: '5%', value: 500 },
] as const

type SwapToken = (typeof SUPPORTED_TOKENS)[number]['symbol']

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2)
}

export default function SwapClient(props: { kitKey: string }) {
  const { kitKey } = props
  const { address, chainId, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { switchChainAsync } = useSwitchChain()

  const [tokenIn, setTokenIn] = useState<SwapToken>('USDC')
  const [tokenOut, setTokenOut] = useState<SwapToken>('EURC')
  const [amountIn, setAmountIn] = useState('1.00')
  const [slippageBps, setSlippageBps] = useState<number>(300)
  const [estimating, setEstimating] = useState(false)
  const [swapping, setSwapping] = useState(false)
  const [estimateResult, setEstimateResult] = useState<unknown>(null)
  const [swapResult, setSwapResult] = useState<unknown>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const tokenOutOptions = useMemo(
    () => SUPPORTED_TOKENS.filter((item) => item.symbol !== tokenIn),
    [tokenIn],
  )

  const adapter = useMemo(() => {
    if (!walletClient) return null

    return new ViemAdapter(
      {
        getPublicClient: ({ chain }) =>
          createPublicClient({
            chain,
            transport: http(),
          }),
        getWalletClient: async () => walletClient,
      },
      {
        addressContext: 'user-controlled',
        supportedChains: [ArcTestnet],
      },
    )
  }, [walletClient])

  const currentChainName = walletClient?.chain?.name ?? (chainId ? `Chain ${chainId}` : '未连接')
  const isOnArcTestnet = chainId === arcTestnet.id
  const hasKitKey = Boolean(kitKey)
  const canEstimateOrSwap = hasKitKey && isConnected && Boolean(adapter)

  const selectedTokenIn = SUPPORTED_TOKENS.find((item) => item.symbol === tokenIn)
  const selectedTokenOut = SUPPORTED_TOKENS.find((item) => item.symbol === tokenOut)

  async function ensureReady() {
    const normalizedAmount = amountIn.trim()
    const parsedAmount = Number(normalizedAmount)

    if (!hasKitKey) {
      throw new Error('缺少 CIRCLE_KIT_KEY，无法调用 Arc Swap。')
    }

    if (!isConnected || !address) {
      throw new Error('请先连接钱包。')
    }

    if (!adapter) {
      throw new Error('钱包上下文尚未准备完成，请稍后重试。')
    }

    if (!normalizedAmount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new Error('请输入有效的交换数量。')
    }

    if (tokenIn === tokenOut) {
      throw new Error('转入与转出代币不能相同。')
    }

    if (!isOnArcTestnet) {
      await switchChainAsync({ chainId: arcTestnet.id })
      throw new Error(`已发起切链，请切换到 ${arcTestnet.name} 后再次执行。`)
    }

    return {
      adapter,
      normalizedAmount,
    }
  }

  async function handleSwitchChain() {
    setError('')
    setMessage('')

    try {
      if (!isConnected) {
        throw new Error('请先连接钱包。')
      }

      await switchChainAsync({ chainId: arcTestnet.id })
      setMessage(`已请求切换到 ${arcTestnet.name}。`)
    } catch (switchError) {
      setError(getErrorMessage(switchError, '切链失败。'))
    }
  }

  function handleFlipTokens() {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
    setEstimateResult(null)
    setSwapResult(null)
    setError('')
    setMessage('')
  }

  async function handleEstimate() {
    setEstimating(true)
    setError('')
    setMessage('')
    setEstimateResult(null)

    try {
      const ready = await ensureReady()

      const result = await kit.estimateSwap({
        from: {
          adapter: ready.adapter,
          chain: BridgeChain.Arc_Testnet,
        },
        tokenIn,
        tokenOut,
        amountIn: ready.normalizedAmount,
        config: {
          kitKey,
          slippageBps,
        },
      })

      setEstimateResult(result)
      setMessage('报价已刷新，可以继续执行 Swap。')
    } catch (estimateError) {
      setError(getErrorMessage(estimateError, '估算失败。'))
    } finally {
      setEstimating(false)
    }
  }

  async function handleSwap() {
    setSwapping(true)
    setError('')
    setMessage('')
    setSwapResult(null)

    try {
      const ready = await ensureReady()

      const result = await kit.swap({
        from: {
          adapter: ready.adapter,
          chain: BridgeChain.Arc_Testnet,
        },
        tokenIn,
        tokenOut,
        amountIn: ready.normalizedAmount,
        config: {
          kitKey,
          slippageBps,
        },
      })

      setSwapResult(result)
      setMessage('Swap 已提交，请查看下方返回结果与浏览器钱包状态。')
    } catch (swapError) {
      setError(getErrorMessage(swapError, '执行 Swap 失败。'))
    } finally {
      setSwapping(false)
    }
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-6xl items-start justify-center px-4 py-5 sm:px-6">
      <Card size="sm" className="w-full max-w-[420px]">
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>兑换</CardTitle>
              <CardDescription className="mt-1">Arc Testnet · USDC / EURC / cirBTC</CardDescription>
            </div>
            <ConnectButton />
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="rounded-4xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">卖出</span>
              <select
                value={tokenIn}
                onChange={(event) => {
                  const nextTokenIn = event.target.value as SwapToken
                  setTokenIn(nextTokenIn)
                  if (nextTokenIn === tokenOut) {
                    const nextOut = SUPPORTED_TOKENS.find((item) => item.symbol !== nextTokenIn)
                    if (nextOut) setTokenOut(nextOut.symbol)
                  }
                }}
                className="h-8 rounded-3xl border border-border bg-background px-3 text-sm text-foreground outline-none"
              >
                {SUPPORTED_TOKENS.map((item) => (
                  <option key={item.symbol} value={item.symbol}>
                    {item.symbol}
                  </option>
                ))}
              </select>
            </div>

            <Input
              value={amountIn}
              onChange={(event) => setAmountIn(event.target.value)}
              inputMode="decimal"
              placeholder="0.0"
              className="mt-3 h-11 border-0 bg-transparent px-0 text-3xl font-semibold tracking-tight shadow-none focus-visible:ring-0"
            />

            <p className="text-xs text-muted-foreground">{selectedTokenIn?.name}</p>
          </div>

          <div className="flex justify-center">
            <Button type="button" variant="outline" size="icon-sm" onClick={handleFlipTokens} aria-label="切换兑换方向">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14" />
                <path d="m7 10 5-5 5 5" />
                <path d="m17 14-5 5-5-5" />
              </svg>
            </Button>
          </div>

          <div className="rounded-4xl border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">买入</span>
              <select
                value={tokenOut}
                onChange={(event) => setTokenOut(event.target.value as SwapToken)}
                className="h-8 rounded-3xl border border-border bg-background px-3 text-sm text-foreground outline-none"
              >
                {tokenOutOptions.map((item) => (
                  <option key={item.symbol} value={item.symbol}>
                    {item.symbol}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 flex h-11 items-center px-0 text-3xl font-semibold tracking-tight text-muted-foreground/60">
              {estimateResult ? '~' : '--'}
            </div>

            <p className="text-xs text-muted-foreground">{selectedTokenOut?.name}</p>
          </div>

          <div className="rounded-4xl border bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">网络</span>
              <Button type="button" variant="outline" size="xs" onClick={handleSwitchChain} disabled={!isConnected || isOnArcTestnet}>
                {isOnArcTestnet ? arcTestnet.name : '切换网络'}
              </Button>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">当前链</span>
              <span className="font-medium text-foreground">{currentChainName}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">滑点</span>
              <select
                value={slippageBps}
                onChange={(event) => setSlippageBps(Number(event.target.value))}
                className="h-7 rounded-3xl border border-border bg-background px-2.5 text-xs text-foreground outline-none"
              >
                {SLIPPAGE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Kit Key</span>
              <span className={hasKitKey ? 'font-medium text-foreground' : 'font-medium text-red-300'}>
                {hasKitKey ? '已配置' : '未配置'}
              </span>
            </div>
          </div>

          {message ? (
            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          ) : null}

          <div className="grid gap-2">
            <Button type="button" variant="outline" onClick={handleEstimate} disabled={!canEstimateOrSwap || estimating || swapping}>
              {estimating ? '估算中...' : '获取报价'}
            </Button>
            <Button type="button" size="lg" onClick={handleSwap} disabled={!canEstimateOrSwap || estimating || swapping}>
              {swapping ? '执行中...' : 'Swap'}
            </Button>
          </div>

          <div className="grid gap-2">
            <div className="rounded-4xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-foreground">报价预览</p>
                <span className="text-[11px] text-muted-foreground">estimateSwap()</span>
              </div>
              {estimateResult ? (
                <pre className="mt-2 max-h-[160px] overflow-auto rounded-3xl bg-background p-3 text-xs leading-6 text-foreground">
                  {formatJson(estimateResult)}
                </pre>
              ) : (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">先获取报价，再决定是否提交链上交易。</p>
              )}
            </div>

            <div className="rounded-4xl border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-foreground">提交结果</p>
                <span className="text-[11px] text-muted-foreground">swap()</span>
              </div>
              {swapResult ? (
                <pre className="mt-2 max-h-[160px] overflow-auto rounded-3xl bg-background p-3 text-xs leading-6 text-foreground">
                  {formatJson(swapResult)}
                </pre>
              ) : (
                <p className="mt-2 text-xs leading-5 text-muted-foreground">当前使用浏览器钱包签名并在 Arc Testnet 发起同链交换。</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
