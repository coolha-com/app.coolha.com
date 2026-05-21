'use client'

type TokenSelectorProps = {
  label?: string
  value?: string
  helperText?: string
}

export function TokenSelector({
  label = '代币',
  value = '选择代币',
  helperText,
}: TokenSelectorProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[1.75rem] border border-border/70 bg-background/80 px-4 py-3">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-base font-medium text-foreground">{value}</p>
      </div>
      <div className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
        {helperText ?? '白名单资产'}
      </div>
    </div>
  )
}
