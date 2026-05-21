'use client'

import {
  Card,
  CardContent,
} from '@/components/ui/card'

type TokenSelectorProps = {
  label?: string
  value?: string
  helperText?: string
}

export function TokenSelector({
  label = 'Token',
  value = 'Select token',
  helperText,
}: TokenSelectorProps) {
  return (
    <Card className="gap-0 rounded-3xl border border-border/60 bg-muted/20 shadow-none">
      <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
          <p className="text-sm font-medium text-foreground">{value}</p>
        </div>
        <div className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
          {helperText ?? 'Whitelist asset'}
        </div>
      </CardContent>
    </Card>
  )
}
