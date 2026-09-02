'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useTranslations } from 'next-intl'
import { mainnet } from 'viem/chains'
import { useEnsAvatar, useEnsName } from 'wagmi'
import { RiWallet3Line } from 'react-icons/ri'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ConnectButtonProps = {
  sidebar?: boolean
  className?: string
}

function getPixelAvatar(address?: string) {
  if (!address) {
    return null
  }

  const seed = encodeURIComponent(address.toLowerCase())
  return `https://api.dicebear.com/9.x/pixel-art-neutral/svg?seed=${seed}&radius=24`
}

export default function ConnectButton({ sidebar = false, className }: ConnectButtonProps) {
  const t = useTranslations('web3')
  const { address, isConnected } = useAppKitAccount()
  const mounted = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  )

  const { open } = useAppKit()

  // 格式化地址显示
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 4)}...${addr.slice(-4)}`
  }

  const { data: ensName } = useEnsName({
    address: address as `0x${string}` | undefined,
    chainId: mainnet.id,
    query: {
      enabled: mounted && isConnected && !!address,
    },
  })

  const { data: ensAvatar } = useEnsAvatar({
    name: ensName as string | undefined,
    chainId: mainnet.id,
    query: {
      enabled: mounted && isConnected && !!ensName,
    },
  })

  const avatarLabel = address ? address.slice(2, 3).toUpperCase() : 'W'
  const pixelAvatar = useMemo(() => getPixelAvatar(address), [address])
  const avatarSrc = ensAvatar ?? pixelAvatar ?? undefined
  const displayName = ensName ?? (address ? formatAddress(address) : t('connect_wallet'))

  if (sidebar) {
    return (
      <div className={cn('relative flex w-full justify-center xl:justify-start', className)}>
        <Button
          onClick={() => open({ view: isConnected ? 'Account' : 'Connect', namespace: 'eip155' })}
          className={cn(
            'size-11 rounded-full p-0 xl:h-11 xl:w-full',
            mounted && isConnected ? 'xl:justify-start xl:gap-3 xl:px-4' : 'xl:justify-center xl:px-4'
          )}
          type="button"
        >
          {mounted && isConnected ? (
            <Avatar size="md" className="size-6 shrink-0 xl:size-6">
              {avatarSrc ? <AvatarImage alt={displayName} src={avatarSrc} /> : null}
              <AvatarFallback className="bg-primary/15 font-semibold text-foreground">
                {avatarLabel}
              </AvatarFallback>
            </Avatar>
          ) : (
            <RiWallet3Line className="size-6 xl:hidden" />
          )}
          <span className={cn('hidden text-sm font-bold xl:inline', mounted && isConnected && 'truncate')}>
            {mounted && isConnected ? displayName : t('connect_wallet')}
          </span>
        </Button>
      </div>
    )
  }

  if (!mounted || !isConnected) {
    return (
      <div className={cn('relative', className)}>
        <Button onClick={() => open({ view: 'Connect', namespace: 'eip155' })} className="rounded-full font-bold">
          {t('connect_wallet')}
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('relative', className)}>
      <Button
        onClick={() => open({ view: "Account" })}
        className="h-10 gap-2 rounded-full px-3 font-bold"
      >
        <Avatar size="sm" className="shrink-0">
          {avatarSrc ? <AvatarImage alt={displayName} src={avatarSrc} /> : null}
          <AvatarFallback className="bg-primary/15 font-semibold text-foreground">
            {avatarLabel}
          </AvatarFallback>
        </Avatar>
        <span className="max-w-32 truncate">
          {displayName}
        </span>
      </Button>
    </div>
  )
}
