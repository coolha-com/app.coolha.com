import ConnectButton from "@/components/web3/ConnectButton"

export default function WalletPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-3xl border bg-card p-6 shadow-sm">
          <h1 className="text-3xl font-semibold tracking-normal">Wallet</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
           钱包地址是 AI 代币中转余额、订阅权益及 X 会员订单的主要身份标识。请在结账前连接 EVM 钱包。
          </p>
          <div className="mt-6">
            <ConnectButton />
          </div>
        </section>
      </div>


    </main>
  )
}

