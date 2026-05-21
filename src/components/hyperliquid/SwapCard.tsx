'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  balanceLabel = 'Balance unavailable',
  quotePreview = 'No quote requested yet',
  isPrimaryDisabled = false,
}: SwapCardProps) {
  return (
    <Card className="gap-4 border border-border/60 bg-card/90 shadow-none backdrop-blur">
      <CardHeader className="gap-2">
        <CardTitle>Swap</CardTitle>
        <CardDescription>
          {isConnected ? 'Review the pair and request a quote.' : 'Connect your wallet to start trading.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TokenSelector
          helperText="Sell token"
          label="From"
          value={sellSymbol}
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="block text-sm font-medium text-foreground" htmlFor="sell-amount">
              Sell amount
            </label>
            <span className="text-xs text-muted-foreground">{balanceLabel}</span>
          </div>
          <Input
            id="sell-amount"
            inputMode="decimal"
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="0.0"
            value={amount}
          />
        </div>
        <TokenSelector
          helperText="Buy token"
          label="To"
          value={buySymbol}
        />
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        <div className="flex items-center justify-between rounded-3xl border border-dashed border-border/80 px-4 py-3 text-sm text-muted-foreground">
          <span>Status</span>
          <span>{statusLabel ?? (isConnected ? 'Ready for quote' : 'Wallet disconnected')}</span>
        </div>
        <div className="rounded-3xl border border-border/70 bg-muted/20 px-4 py-3 text-sm">
          <p className="text-muted-foreground">Quote preview</p>
          <p className="mt-1 font-medium text-foreground">{quotePreview}</p>
        </div>
        <Button className="w-full" disabled={isPrimaryDisabled} onClick={onPrimaryAction} type="button">
          {primaryLabel}
        </Button>
      </CardFooter>
    </Card>
  )
}
