import ConnectButton from "@/components/web3/ConnectButton"
import { supportedChains } from "@/lib/aifi-data"

export default function WalletPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-3xl border bg-card p-6 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-normal">Wallet</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Wallet address is the primary identity. Connect an EVM wallet to view balances, network, and portfolio data.
          </p>
          <div className="mt-6">
            <ConnectButton />
          </div>
        </section>

        <section className="rounded-3xl border bg-card p-6 shadow-sm">
          <h2 className="font-semibold">Supported Networks</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {supportedChains.map((chain) => (
              <div key={chain} className="rounded-2xl border bg-background p-4">
                <div className="font-medium">{chain}</div>
                <div className="mt-1 text-sm text-muted-foreground">USDC / USDT settlement planned</div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
            Transactions must be confirmed on-chain before balances or purchases are treated as complete.
          </div>
        </section>
      </div>
    </main>
  )
}

