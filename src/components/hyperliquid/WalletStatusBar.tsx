'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type WalletStatusBarProps = {
  networkLabel?: string
  addressLabel?: string
  connectionLabel?: string
  gasLabel?: string
}

export function WalletStatusBar({
  networkLabel = 'HyperEVM',
  addressLabel = 'Not connected',
  connectionLabel = 'Disconnected',
  gasLabel = 'Check HYPE balance',
}: WalletStatusBarProps) {
  return (
    <Card className="gap-4 border border-border/60 bg-card/90 shadow-none backdrop-blur">
      <CardHeader className="gap-2">
        <CardTitle>Wallet Status</CardTitle>
        <CardDescription>Connection, network, and gas readiness</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-4">
        <div className="rounded-3xl border border-border/70 bg-muted/20 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status</p>
          <p className="mt-2 text-sm font-medium text-foreground">{connectionLabel}</p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-muted/20 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Network</p>
          <p className="mt-2 text-sm font-medium text-foreground">{networkLabel}</p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-muted/20 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Wallet</p>
          <p className="mt-2 text-sm font-medium text-foreground">{addressLabel}</p>
        </div>
        <div className="rounded-3xl border border-border/70 bg-muted/20 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Gas</p>
          <p className="mt-2 text-sm font-medium text-foreground">{gasLabel}</p>
        </div>
      </CardContent>
    </Card>
  )
}
