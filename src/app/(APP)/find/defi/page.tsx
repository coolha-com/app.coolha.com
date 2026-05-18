'use client'

import { useMemo, useState } from 'react'
import { useAppKitAccount } from '@reown/appkit/react'
import { useWalletClient } from 'wagmi'

type Mode = 'supply' | 'borrow'
type StableSymbol = 'USDC' | 'USDT'

type MarketItem = {
  id: string
  symbol: StableSymbol
  chainName: string
  chainId: number
  supplyApy: number
  borrowApy: number
  canSupply: boolean
  canBorrow: boolean
  suppliable: number
  borrowable: number
  totalSupplied: number
  totalBorrowed: number
  utilization: number
}

const CHAIN_OPTIONS = [
  { id: 11155111, name: 'Ethereum Sepolia' },
  { id: 84532, name: 'Base Sepolia' },
  { id: 11124, name: 'Arc Testnet' },
]

const MOCK_MARKETS: MarketItem[] = [
  {
    id: 'sepolia-usdc',
    symbol: 'USDC',
    chainName: 'Ethereum Sepolia',
    chainId: 11155111,
    supplyApy: 4.82,
    borrowApy: 7.14,
    canSupply: true,
    canBorrow: true,
    suppliable: 980000,
    borrowable: 410000,
    totalSupplied: 1250000,
    totalBorrowed: 760000,
    utilization: 60.8,
  },
  {
    id: 'base-usdc',
    symbol: 'USDC',
    chainName: 'Base Sepolia',
    chainId: 84532,
    supplyApy: 5.31,
    borrowApy: 7.92,
    canSupply: true,
    canBorrow: true,
    suppliable: 1420000,
    borrowable: 660000,
    totalSupplied: 1840000,
    totalBorrowed: 1030000,
    utilization: 55.98,
  },
  {
    id: 'base-usdt',
    symbol: 'USDT',
    chainName: 'Base Sepolia',
    chainId: 84532,
    supplyApy: 5.08,
    borrowApy: 8.41,
    canSupply: true,
    canBorrow: false,
    suppliable: 720000,
    borrowable: 0,
    totalSupplied: 930000,
    totalBorrowed: 602000,
    utilization: 64.73,
  },
  {
    id: 'arc-usdc',
    symbol: 'USDC',
    chainName: 'Arc Testnet',
    chainId: 11124,
    supplyApy: 6.12,
    borrowApy: 9.28,
    canSupply: true,
    canBorrow: true,
    suppliable: 540000,
    borrowable: 240000,
    totalSupplied: 810000,
    totalBorrowed: 420000,
    utilization: 51.85,
  },
]

function compactValue(value: number): string {
  if (!Number.isFinite(value)) return '--'
  return new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

function toSafeNumber(input: string): number {
  const parsed = Number(input)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function DefiPage() {
  const [mode, setMode] = useState<Mode>('supply')
  const [selectedChainId, setSelectedChainId] = useState<number>(84532)
  const [selectedReserveId, setSelectedReserveId] = useState<string>('')
  const [keyword, setKeyword] = useState<string>('')
  const [amountInput, setAmountInput] = useState<string>('10')
  const [actionMessage, setActionMessage] = useState<string>('')

  const { address, isConnected } = useAppKitAccount()
  const { data: walletClient } = useWalletClient()

  const filteredMarkets = useMemo(() => {
    const lower = keyword.trim().toLowerCase()
    const byChain = MOCK_MARKETS.filter((item) => item.chainId === selectedChainId)
    const byMode = byChain.filter((item) => (mode === 'supply' ? item.canSupply : item.canBorrow))
    const byKeyword = lower
      ? byMode.filter((item) => item.symbol.toLowerCase().includes(lower) || item.chainName.toLowerCase().includes(lower))
      : byMode
    return [...byKeyword].sort((a, b) => (mode === 'supply' ? b.supplyApy - a.supplyApy : a.borrowApy - b.borrowApy))
  }, [keyword, mode, selectedChainId])

  const selectedMarket = useMemo(
    () => filteredMarkets.find((item) => item.id === selectedReserveId) ?? filteredMarkets[0],
    [filteredMarkets, selectedReserveId],
  )

  const walletChainId = walletClient?.chain?.id ?? null
  const chainMatched = walletChainId === selectedChainId

  const handleExecute = async () => {
    setActionMessage('')
    if (!isConnected || !address) {
      setActionMessage('请先使用全局钱包入口连接钱包。')
      return
    }
    if (!chainMatched) {
      setActionMessage(`当前钱包网络(${walletChainId ?? '未知'})与页面网络(${selectedChainId})不一致，请先切换网络。`)
      return
    }
    if (!selectedMarket) {
      setActionMessage('当前没有可执行的市场。')
      return
    }
    const amount = toSafeNumber(amountInput)
    if (amount <= 0) {
      setActionMessage('请输入大于 0 的数量。')
      return
    }

    setActionMessage(
      `${mode === 'supply' ? '借出' : '借入'}请求已进入 mock 流程：${selectedMarket.symbol} ${amount}，当前不会发送真实链上交易。`
    )
  }

  return (
    <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-3 text-foreground md:px-5 md:py-5">
      <section className="rounded-[24px] border border-amber-500/30 bg-amber-500/10 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
              Test Environment
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">当前页面已切换为纯 mock DeFi 市场</p>
            <p className="mt-1 text-sm text-muted-foreground">
              当前展示的资产、收益率、可借额度与执行结果均为本地 mock 数据，仅用于交互和布局测试。
            </p>
          </div>
          <div className="rounded-full border border-amber-500/30 bg-background/80 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300">
            Mock Only
          </div>
        </div>
      </section>

      <section className="mx-auto mt-4 grid max-w-7xl gap-4 xl:grid-cols-[1.85fr_1fr]">
        <article className="overflow-hidden rounded-[26px] border border-border bg-card/95 shadow-sm backdrop-blur">
          <div className="border-b border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">DeFi Test Markets</p>
                <h1 className="mt-1 text-xl font-semibold text-foreground md:text-2xl">
                  {mode === 'supply' ? '借出市场' : '借入市场'}
                </h1>
              </div>
              <div className="inline-flex rounded-2xl border border-border bg-muted p-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setMode('supply')}
                  className={`rounded-xl px-4 py-1.5 text-sm transition ${mode === 'supply' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  借出
                </button>
                <button
                  type="button"
                  onClick={() => setMode('borrow')}
                  className={`rounded-xl px-4 py-1.5 text-sm transition ${mode === 'borrow' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  借入
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-[1.3fr_0.9fr_0.8fr]">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索资产、网络..."
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              <select
                value={selectedChainId}
                onChange={(event) => setSelectedChainId(toSafeNumber(event.target.value))}
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none"
              >
                {CHAIN_OPTIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.id})
                  </option>
                ))}
              </select>
              <div className="flex h-10 items-center rounded-xl border border-border bg-muted px-3 text-xs text-muted-foreground">
                支持链：{CHAIN_OPTIONS.length}
              </div>
            </div>
          </div>

          <div className="px-4 pb-4 pt-3">
            <div className="grid grid-cols-[1.5fr_0.7fr_0.9fr_0.9fr_0.7fr] gap-2 px-2 py-2 text-xs text-muted-foreground">
              <p>资产</p>
              <p>{mode === 'supply' ? '借出 APY' : '借入 APY'}</p>
              <p>总借出</p>
              <p>{mode === 'supply' ? '可借出' : '可借入'}</p>
              <p>利用率</p>
            </div>

            <div className="max-h-[64vh] space-y-1 overflow-y-auto pr-1">
              {filteredMarkets.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedReserveId(item.id)}
                  className={`grid w-full grid-cols-[1.5fr_0.7fr_0.9fr_0.9fr_0.7fr] items-center gap-2 rounded-xl border px-2 py-3 text-left text-sm transition ${selectedMarket?.id === item.id
                    ? 'border-primary/25 bg-primary/10'
                    : 'border-border bg-card/70 hover:border-primary/20 hover:bg-muted/40'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
                      {item.symbol.slice(0, 2)}
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{item.symbol}</p>
                      <p className="text-xs text-muted-foreground">{item.chainName}</p>
                    </div>
                  </div>
                  <p className={`${mode === 'supply' ? 'text-primary' : 'text-chart-5'}`}>
                    {mode === 'supply' ? `${item.supplyApy.toFixed(2)}%` : `${item.borrowApy.toFixed(2)}%`}
                  </p>
                  <p className="text-foreground">{compactValue(item.totalSupplied)}</p>
                  <p className="text-foreground">{compactValue(mode === 'supply' ? item.suppliable : item.borrowable)}</p>
                  <p className="text-muted-foreground">{item.utilization.toFixed(1)}%</p>
                </button>
              ))}
              {filteredMarkets.length === 0 && (
                <p className="rounded-xl border border-border bg-card/70 p-4 text-sm text-muted-foreground">
                  当前筛选下没有可用市场。
                </p>
              )}
            </div>
          </div>
        </article>

        <article className="h-fit rounded-[26px] border border-border bg-card/95 p-5 shadow-sm backdrop-blur xl:sticky xl:top-5">
          <h2 className="text-lg font-semibold text-foreground">{mode === 'supply' ? '借出' : '借入'}操作</h2>
          <p className="mt-1 text-xs text-muted-foreground">纯 mock 右侧执行面板，不依赖外部借贷 SDK</p>

          <div className="mt-4 rounded-xl border border-border bg-background p-3 text-sm text-foreground">
            <p>网络：{CHAIN_OPTIONS.find((item) => item.id === selectedChainId)?.name ?? '未知'} ({selectedChainId})</p>
            <p className="mt-1">资产：{selectedMarket?.symbol ?? '未选择'}</p>
            <p className="mt-1">借出 APY：{selectedMarket ? `${selectedMarket.supplyApy.toFixed(2)}%` : '--'}</p>
            <p className="mt-1">借入 APY：{selectedMarket ? `${selectedMarket.borrowApy.toFixed(2)}%` : '--'}</p>
            <p className="mt-1">钱包网络：{walletChainId ?? '未连接'}</p>
          </div>

          <div className="mt-3 rounded-xl border border-border bg-background p-3">
            <label className="text-xs text-muted-foreground">数量</label>
            <input
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              placeholder="例如 10"
              inputMode="decimal"
            />
          </div>

          <button
            type="button"
            onClick={handleExecute}
            disabled={!selectedMarket || (mode === 'supply' ? !selectedMarket.canSupply : !selectedMarket.canBorrow)}
            className="mt-4 h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {`${mode === 'supply' ? '借出' : '借入'} ${selectedMarket?.symbol ?? '资产'}`}
          </button>

          <div className="mt-4 rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
            <div className="space-y-1">
              <p>当前市场：{filteredMarkets.length}</p>
              <p>模式：{mode === 'supply' ? '借出（Supply）' : '借入（Borrow）'}</p>
              <p>数据源：本地 mock</p>
            </div>
          </div>

          {actionMessage && <p className="mt-3 break-all text-xs text-muted-foreground">{actionMessage}</p>}
        </article>
      </section>
    </main>
  )
}
