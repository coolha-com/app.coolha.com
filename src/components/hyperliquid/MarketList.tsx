'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const DEFAULT_MARKETS = ['HYPE / USDC', 'ETH / USDC', 'BTC / USDC', 'USDT0 / HYPE']

type MarketListProps = {
  markets?: string[]
}

export function MarketList({ markets = DEFAULT_MARKETS }: MarketListProps) {
  return (
    <Card className="gap-4 border border-border/60 bg-card/90 shadow-none backdrop-blur">
      <CardHeader className="gap-2">
        <CardTitle>Markets</CardTitle>
        <CardDescription>Whitelist spot pairs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {markets.map((market) => (
          <div
            className="flex items-center justify-between rounded-3xl border border-border/70 bg-muted/20 px-4 py-3 text-sm"
            key={market}
          >
            <span className="font-medium text-foreground">{market}</span>
            <span className="text-muted-foreground">24h</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
