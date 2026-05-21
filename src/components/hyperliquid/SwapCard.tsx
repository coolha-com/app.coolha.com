'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TokenSelector } from './TokenSelector'

type SwapCardProps = {
  isConnected: boolean
  amount: string
  onAmountChange: (value: string) => void
  onPrimaryAction: () => void
  primaryLabel: string
  sellSymbol?: string
  buySymbol?: string
  statusLabel?: string
  balanceLabel?: string
  quotePreview?: string
  isPrimaryDisabled?: boolean
  onSwapDirection?: () => void
  isSwapDirectionDisabled?: boolean
}

export function SwapCard({
  isConnected,
  amount,
  onAmountChange,
  onPrimaryAction,
  primaryLabel,
  sellSymbol = 'USDC',
  buySymbol = 'HYPE',
  statusLabel,
  balanceLabel = '余额暂不可用',
  quotePreview = '尚未请求报价',
  isPrimaryDisabled = false,
  onSwapDirection,
  isSwapDirectionDisabled = false,
}: SwapCardProps) {
  return (
    <section className="rounded-[2rem] border border-border/70 bg-card/95 p-3 shadow-xl ring-1 ring-foreground/5 backdrop-blur">
      <div className="space-y-3 rounded-[1.5rem] bg-muted/30 p-3">
        <div className="flex items-start justify-between gap-3 rounded-[1.5rem] bg-background/90 p-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-muted-foreground" htmlFor="sell-amount">
                卖出数量
              </label>
              <span className="text-xs text-muted-foreground">{balanceLabel}</span>
            </div>
            <Input
              id="sell-amount"
              inputMode="decimal"
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder="0.0"
              value={amount}
              className="h-auto border-0 bg-transparent px-0 text-4xl font-semibold shadow-none focus-visible:ring-0"
            />
            <TokenSelector
              helperText="卖出币种"
              label="资产"
              value={sellSymbol}
            />
          </div>
        </div>
        <div className="relative flex justify-center py-1">
          <Button
            className="absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-border/80 bg-background text-foreground hover:bg-muted"
            disabled={isSwapDirectionDisabled}
            onClick={onSwapDirection}
            size="icon"
            type="button"
            variant="outline"
          >
            ↕
          </Button>
        </div>
        <div className="flex items-start justify-between gap-3 rounded-[1.5rem] bg-background/90 p-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">买入</span>
              <span className="text-xs text-muted-foreground">{quotePreview}</span>
            </div>
            <div className="text-4xl font-semibold tracking-tight text-foreground">--</div>
            <TokenSelector
              helperText="买入币种"
              label="资产"
              value={buySymbol}
            />
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-3">
        <div className="rounded-[1.5rem] border border-dashed border-border/80 px-4 py-3 text-sm text-muted-foreground">
          {statusLabel ?? (isConnected ? '可以开始请求报价' : '钱包未连接')}
        </div>
        <Button className="h-12 w-full text-base font-semibold" disabled={isPrimaryDisabled} onClick={onPrimaryAction} type="button">
          {primaryLabel}
        </Button>
      </div>
    </section>
  )
}
