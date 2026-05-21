'use client'

import {
  CardDescription,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type MarketItem = {
  id: string
  label: string
  subtitle?: string
  changeLabel?: string
}

const DEFAULT_MARKETS: MarketItem[] = [
  { id: 'hype-usdc', label: 'HYPE / USDC', subtitle: 'USDC -> HYPE', changeLabel: '+2.8%' },
  { id: 'eth-usdc', label: 'ETH / USDC', subtitle: 'USDC -> ETH', changeLabel: '+1.2%' },
  { id: 'btc-usdc', label: 'BTC / USDC', subtitle: 'USDC -> BTC', changeLabel: '+0.7%' },
  { id: 'usdt0-hype', label: 'USDT0 / HYPE', subtitle: 'HYPE -> USDT0', changeLabel: '-0.3%' },
]

type MarketListProps = {
  markets?: MarketItem[]
  activeMarketId?: string
  onSelectMarket?: (marketId: string) => void
}

export function MarketList({
  markets = DEFAULT_MARKETS,
  activeMarketId,
  onSelectMarket,
}: MarketListProps) {
  return (
    <Card className="gap-4 border border-border/60 bg-card/90 shadow-none backdrop-blur">
      <CardHeader className="gap-2">
        <CardTitle>Markets</CardTitle>
        <CardDescription>Whitelist spot pairs on HyperEVM</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {markets.map((market) => (
          <button
            className={`flex w-full items-center justify-between rounded-3xl border px-4 py-3 text-left text-sm transition ${
              activeMarketId === market.id
                ? 'border-primary/40 bg-primary/10'
                : 'border-border/70 bg-muted/20 hover:border-primary/20 hover:bg-muted/40'
            }`}
            key={market.id}
            onClick={() => onSelectMarket?.(market.id)}
            type="button"
          >
            <div>
              <span className="font-medium text-foreground">{market.label}</span>
              <p className="mt-1 text-xs text-muted-foreground">{market.subtitle ?? 'Whitelist market'}</p>
            </div>
            <span className="text-muted-foreground">{market.changeLabel ?? '24h'}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
