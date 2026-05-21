import { cookieStorage, createStorage, http } from "@wagmi/core"
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { arcTestnet, baseSepolia, sepolia, tempoTestnet,hyperliquidEvmTestnet } from "@reown/appkit/networks"

export const networks = [sepolia, baseSepolia, arcTestnet,tempoTestnet,hyperliquidEvmTestnet]  
export const defaultNetwork = sepolia

export function resolveWalletProjectId(explicitProjectId?: string | null) {
  return explicitProjectId?.trim() || process.env.NEXT_PUBLIC_REOWN_ID || process.env.REOWN_ID || ""
}

function createWalletRuntime(projectId: string) {
  const wagmiAdapter = new WagmiAdapter({
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: false,
    projectId,
    networks,
    transports: {
      [baseSepolia.id]: http(baseSepolia.rpcUrls.default.http[0]),
      [sepolia.id]: http(sepolia.rpcUrls.default.http[0]),
      [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
      [tempoTestnet.id]: http(tempoTestnet.rpcUrls.default.http[0]),
      [hyperliquidEvmTestnet.id]: http(hyperliquidEvmTestnet.rpcUrls.default.http[0]),
    },
  })

  return {
    projectId,
    wagmiAdapter,
    config: wagmiAdapter.wagmiConfig,
  }
}

export type WalletRuntime = ReturnType<typeof createWalletRuntime>

let cachedWalletRuntime: WalletRuntime | null = null

export function getWalletRuntime(projectId: string) {
  if (!projectId) {
    throw new Error("Project ID is not defined")
  }

  if (cachedWalletRuntime?.projectId === projectId) {
    return cachedWalletRuntime
  }

  cachedWalletRuntime = createWalletRuntime(projectId)
  return cachedWalletRuntime
}
