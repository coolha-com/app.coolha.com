import Link from 'next/link'

export default function FindDefiPage() {
  return (
    <main className="min-h-[calc(100dvh-120px)] w-full bg-background px-4 py-5 md:px-6 md:py-7">
      <section className="mx-auto w-full max-w-5xl rounded-[28px] border border-border bg-card p-6 shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">DeFi</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">DeFi route adapters</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          Aave lending and Uniswap swap adapters are scaffolded under the shared DeFi Router abstraction. This page is reserved for a future DeFi marketplace surface.
        </p>
        <Link
          href="/discover"
          className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Open RWA Marketplace
        </Link>
      </section>
    </main>
  )
}
