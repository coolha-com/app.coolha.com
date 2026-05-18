'use client'

import { useSyncExternalStore } from 'react'
import { useAppKit, useAppKitAccount } from '@reown/appkit/react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'

export default function Connect() {
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
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (!mounted || !isConnected) {
    return (
      <div className="relative">
        <Button onClick={() => open({ view: 'Connect', namespace: 'eip155' })} className="rounded-full font-bold">
          {t('connect_wallet')}
        </Button>
      </div>
    )
  }

  return (
    <div className="relative">
      <Button
        onClick={() => open({ view: "Account" })}
        className="rounded-full font-bold"
      >
        {address ? formatAddress(address) : t('account')}
      </Button>
    </div>
  )
}
