import SwapClient from './SwapClient'

export default function WalletSwapPage() {
  const kitKey = process.env.CIRCLE_KIT_KEY ?? ''

  return <SwapClient kitKey={kitKey} />
}
