'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useEffect, useMemo } from 'react'
import { cookieToInitialState, WagmiProvider } from 'wagmi'
import { useTheme } from 'next-themes'
import { createAppKit } from '@reown/appkit/react'
import { sepolia, baseSepolia, arcTestnet } from '@reown/appkit/networks'
import { getWalletRuntime, resolveWalletProjectId } from './wagmi'

// Set up queryClient
export const queryClient = new QueryClient()

export const metadata = {
    name: 'Coolha',
    description: 'Coolha Web Dapp',
    url: 'https://coolha.com',
    icons: ['https://coolha.com/favicon.ico'],
    termsConditionsUrl: "https://docs.coolha.com/docs/apps/terms",
    privacyPolicyUrl: "https://docs.coolha.com/docs/apps/privacy",
}
type WagmiProviderProps = {
    children: ReactNode
    cookies: string | null
    walletProjectId?: string | null
}

export default function Wagmi_Provider({ children, cookies, walletProjectId }: WagmiProviderProps) {
    const { theme, resolvedTheme } = useTheme()
    const resolvedProjectId = resolveWalletProjectId(walletProjectId)
    const walletRuntime = useMemo(
        () => (resolvedProjectId ? getWalletRuntime(resolvedProjectId) : null),
        [resolvedProjectId]
    )
    const modal = useMemo(() => {
        if (!walletRuntime) return null

        return createAppKit({
            adapters: [walletRuntime.wagmiAdapter],
            projectId: walletRuntime.projectId,
            networks: [sepolia, baseSepolia, arcTestnet],
            defaultNetwork: sepolia,
            allowUnsupportedChain: false,
            chainImages: {
                8453: '/web3/base.png',
                84532:'/web3/base.png',
                5042002:'/web3/arc-testnet.png'
            },
            metadata,
            themeMode: 'dark',
            themeVariables: {
                '--w3m-accent': '#accf00',
            },
            features: {
                analytics: true,
                emailShowWallets: false,
                legalCheckbox: true,
            },
            enableWalletGuide: false,
            enableCoinbase: false,
            allWallets: 'SHOW',
            featuredWalletIds: [
              
                'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
               
                '1ae92b26df02f0abca6304df07debccd18262fdf5fe82daa81593582dac9a369',
                '225affb176778569276e484e1b92637ad061b01e13a048b35a9d280c3b58970f',
            ]
        })
    }, [walletRuntime])

    // Sync theme with AppKit
    useEffect(() => {
        if (modal && (theme || resolvedTheme)) {
            const currentTheme = theme === 'system' ? resolvedTheme : theme
            modal.setThemeMode(currentTheme as 'light' | 'dark')
        }
    }, [modal, theme, resolvedTheme])

    if (!walletRuntime) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }

    return (
        <WagmiProvider config={walletRuntime.config} initialState={cookieToInitialState(walletRuntime.config, cookies)}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    )
}
