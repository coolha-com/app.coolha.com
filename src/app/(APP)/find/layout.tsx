import type { ReactNode } from 'react'

type FindLayoutProps = {
  children: ReactNode
}

export default function FindLayout({ children }: FindLayoutProps) {
  return (
    <div className="min-h-[calc(100dvh-120px)] w-full bg-background text-foreground">
      {children}
    </div>
  )
}
