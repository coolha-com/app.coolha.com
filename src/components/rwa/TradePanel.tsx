'use client'

import { useMemo, useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import type { RWAAsset } from '@/lib/rwa/types'
import { pickRouterAdapter } from '@/lib/rwa/routerAdapter'

function toSafeNumber(input: string): number {
  const parsed = Number(input)
  return Number.isFinite(parsed) ? parsed : 0
}

export function TradePanel(props: { asset: RWAAsset }) {
  const adapter = useMemo(() => pickRouterAdapter(), [])
  const { address, isConnected, chainId } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [amount, setAmount] = useState<string>('100')
  const [token] = useState<'USDC'>('USDC')
  const [status, setStatus] = useState<'idle' | 'simulating' | 'ready'>('idle')
  const [result, setResult] = useState<{
    txHashPreview: `0x${string}`
    routeLabel: string
    to: `0x${string}`
    data: `0x${string}`
    estimatedGas: string
  } | null>(null)
  const [message, setMessage] = useState<string>('')

  const simulateTransaction = async () => {
    setMessage('')
    setResult(null)
    const n = toSafeNumber(amount)
    if (n <= 0) {
      setMessage('请输入大于 0 的金额。')
      return
    }
    setStatus('simulating')
    const sim = await adapter.simulate({
      assetId: props.asset.id,
      amountIn: n,
      tokenIn: token,
      chainId: props.asset.chainId ?? 1,
      user: address as `0x${string}` | undefined,
    })
    setResult({
      txHashPreview: sim.txHashPreview,
      routeLabel: sim.routeLabel,
      to: sim.tx.to,
      data: sim.tx.data,
      estimatedGas: sim.estimatedGas.toString(),
    })
    setStatus('ready')
    setMessage('已完成 mock simulateTransaction()，当前未发送真实链上交易。')
  }

  return (
    <section className="rounded-[28px] border border-border bg-card/95 p-5 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Trade Module</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">交易模块（Mock Router）</h2>
        </div>
        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">{adapter.label}</span>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        当前通过 wagmi 获取钱包上下文，并模拟 Uniswap Router 调用结构；不执行真实 swap，仅返回 route、gas 与交易请求预览。
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[22px] border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Token</p>
          <div className="mt-2 flex h-10 items-center rounded-xl border border-input bg-background px-3 text-sm text-foreground">
            {token}
          </div>
        </div>
        <div className="rounded-[22px] border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Amount</p>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary/25"
            placeholder="例如 100"
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[22px] border border-border bg-muted/15 p-3">
          <p className="text-xs text-muted-foreground">钱包状态</p>
          <p className="mt-1 text-sm font-medium text-foreground">{isConnected ? '已连接' : '未连接'}</p>
        </div>
        <div className="rounded-[22px] border border-border bg-muted/15 p-3">
          <p className="text-xs text-muted-foreground">当前链</p>
          <p className="mt-1 text-sm font-medium text-foreground">{chainId ?? '--'}</p>
        </div>
        <div className="rounded-[22px] border border-border bg-muted/15 p-3">
          <p className="text-xs text-muted-foreground">目标 Router</p>
          <p className="mt-1 truncate text-sm font-medium text-foreground">{walletClient?.chain?.name ?? 'Wagmi Context'}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={simulateTransaction}
        disabled={status === 'simulating'}
        className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === 'simulating' ? '模拟中...' : '模拟交易'}
      </button>

      {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}

      {result ? (
        <div className="mt-4 rounded-[24px] border border-border bg-muted/15 p-4 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-foreground">Simulation Result</p>
            <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-700 dark:text-amber-300">
              Mock Only
            </span>
          </div>

          <div className="mt-3 space-y-2">
            <p>Route: {result.routeLabel}</p>
            <p className="break-all">TxHash Preview: {result.txHashPreview}</p>
            <p className="break-all">To: {result.to}</p>
            <p className="break-all">Data: {result.data || '0x'}</p>
            <p>Estimated Gas: {result.estimatedGas}</p>
            <p>Wallet: {address ?? '未连接'}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-[24px] border border-border bg-background p-4 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">routerAdapter 预留结构</p>
        <div className="mt-2 space-y-1">
          <p>adapter.id: {adapter.id}</p>
          <p>adapter.label: {adapter.label}</p>
          <p>future: Ondo / Centrifuge / Uniswap / Custom Router</p>
        </div>
      </div>
    </section>
  )
}
