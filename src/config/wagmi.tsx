import { WagmiAdapter } from "@reown/appkit-adapter-wagmi"
import { mainnet,sepolia,base,bsc } from "@reown/appkit/networks"
import { cookieStorage, createStorage, http } from "@wagmi/core"

export const networks: [
  typeof mainnet,
  typeof sepolia,
  typeof base,
  typeof bsc,
] = [mainnet,sepolia, base,bsc]
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
      [mainnet.id]: http(mainnet.rpcUrls.default.http[0]),
      [sepolia.id]: http(sepolia.rpcUrls.default.http[0]),
      [base.id]: http(base.rpcUrls.default.http[0]),
      [bsc.id]: http(bsc.rpcUrls.default.http[0]),
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
