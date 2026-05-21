'use client'

type RiskBadgesProps = {
  items?: string[]
}

export function RiskBadges({ items = ['Gas', 'Slippage', 'Price impact'] }: RiskBadgesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300"
          key={item}
        >
          {item}
        </span>
      ))}
    </div>
  )
}
