'use client'

import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useAppKitAccount } from '@reown/appkit/react'
import { useTranslations } from 'next-intl'
import { mainnet } from 'viem/chains'
import { useEnsAvatar, useEnsName } from 'wagmi'
import { RiLoginBoxLine } from 'react-icons/ri'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

type ConnectButtonProps = {
  sidebar?: boolean
  /** 侧边栏内是否展开文字标签（由侧边栏模式决定，与视口宽度无关） */
  showLabels?: boolean
  className?: string
}

/** 未登入去登录页；已登入进账户主页（不是再回登录页）。 */
const SIGN_IN_HREF = '/signin'
const ACCOUNT_HREF = '/settings/account'

export default function ConnectButton({ sidebar = false, showLabels = false, className }: ConnectButtonProps) {
  const t = useTranslations('web3')
  const { address } = useAppKitAccount()
  const auth = useAuth()
  const mounted = useSyncExternalStore(
    () => () => { },
    () => true,
    () => false,
  )

  const formatAddress = (addr: string) => `${addr.slice(0, 4)}...${addr.slice(-4)}`

  // ENS 只有「钱包登录且没有 Web2 身份」时才查——邮箱用户没有地址可解析
  const ensEnabled = mounted && auth.source === 'wallet' && !!address

  const { data: ensName } = useEnsName({
    address: address as `0x${string}` | undefined,
    chainId: mainnet.id,
    query: { enabled: ensEnabled },
  })

  const { data: ensAvatar } = useEnsAvatar({
    name: ensName as string | undefined,
    chainId: mainnet.id,
    query: { enabled: ensEnabled && !!ensName },
  })

  const loggedIn = mounted && auth.ready && auth.signedIn
  const displayName =
    auth.label || ensName || (address ? formatAddress(address) : t('sign_in'))

  // 头像优先级：用户设过的头像 → ENS 头像 → 首字母占位（不再生成随机像素头像）
  const avatarSrc = auth.image ?? ensAvatar ?? undefined
  const avatarLabel = (
    auth.name?.trim() ||
    auth.email?.trim() ||
    (address ? address.slice(2, 3) : 'C')
  )
    .slice(0, 1)
    .toUpperCase()

  const href = loggedIn ? ACCOUNT_HREF : SIGN_IN_HREF

  if (sidebar) {
    /**
     * 与「更多」按钮（ButtonMenu）逐类对齐：同样的 size-11 / px-4 / gap-2 / rounded-full，
     * 图标位是 24px 的头部或登入图标，所以头像与图标同 x，名称与「更多」文字同 x。
     * 底色用背景色 + 外框线（不用主题色），悬浮时与「更多」一致的 bg-accent 加一层轻阴影。
     */
    return (
      <Link
        href={href}
        title={showLabels ? undefined : loggedIn ? displayName : t('sign_in')}
        aria-label={loggedIn ? `账户：${displayName}` : t('sign_in')}
        className={cn(
          'inline-flex size-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border bg-background p-0 text-sm font-medium transition-all outline-none',
          'hover:bg-accent hover:text-accent-foreground hover:shadow-sm',
          'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          '[&_svg]:pointer-events-none [&_svg]:shrink-0',
          showLabels && 'h-11 w-full justify-start px-4',
          className,
        )}
      >
        {loggedIn ? (
          <Avatar className="size-6 shrink-0">
            {avatarSrc ? <AvatarImage alt={displayName} src={avatarSrc} /> : null}
            <AvatarFallback className="bg-primary/15 text-xs font-semibold text-foreground">
              {avatarLabel}
            </AvatarFallback>
          </Avatar>
        ) : (
          <RiLoginBoxLine className="size-6" />
        )}
        <span className={cn('min-w-0 truncate text-lg', !showLabels && 'hidden')}>
          {loggedIn ? displayName : t('sign_in')}
        </span>
      </Link>
    )
  }

  return (
    <div className={cn('relative', className)}>
      <Button asChild className={cn('font-bold', loggedIn ? 'h-10 gap-2 rounded-full px-3' : 'rounded-full')}>
        <Link href={href} aria-label={loggedIn ? `账户：${displayName}` : t('sign_in')}>
          {loggedIn ? (
            <>
              <Avatar size="sm" className="shrink-0">
                {avatarSrc ? <AvatarImage alt={displayName} src={avatarSrc} /> : null}
                <AvatarFallback className="bg-primary/15 font-semibold text-foreground">
                  {avatarLabel}
                </AvatarFallback>
              </Avatar>
              <span className="max-w-32 truncate">{displayName}</span>
            </>
          ) : (
            t('sign_in')
          )}
        </Link>
      </Button>
    </div>
  )
}
