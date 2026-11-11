"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAppKit, useAppKitAccount } from "@reown/appkit/react"
import {
  RiCheckLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiShieldKeyholeLine,
  RiWallet3Line,
} from "react-icons/ri"

import { Surface } from "@/components/PageShell"
import { ACCOUNT_CARD_CLASS, ACCOUNT_ROW_CLASS } from "./styles"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import type { AccountWallet } from "./types"

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/**
 * 钱包地址：列出、绑定、解绑。
 *
 * 绑定 = 连上钱包 + 签一条 SIWE 消息（intent=bind），服务端验签通过后挂到当前 users.id。
 * 解绑会被服务端拒绝「最后一个凭证」，避免把账号锁死。
 */
export function WalletsCard({
  wallets,
  hasNonWalletCredential,
  currentAddress,
}: {
  wallets: AccountWallet[]
  hasNonWalletCredential: boolean
  currentAddress: string | null
}) {
  const router = useRouter()
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const { bindWallet, error } = useWalletAuth()
  const { refresh } = useAuth()
  const [pending, setPending] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  // 「换绑」只挂在一行上：优先当前登录的那个钱包，否则第一行
  const rebindTarget =
    wallets.find((wallet) => wallet.address.toLowerCase() === currentAddress?.toLowerCase())
      ?.address ?? wallets[0]?.address

  const alreadyBound = wallets.some(
    (wallet) => address && wallet.address.toLowerCase() === address.toLowerCase(),
  )

  async function bind() {
    setPending(true)
    setMessage(null)
    try {
      const result = await bindWallet()
      if (!result) {
        setMessage({ ok: false, text: "绑定未完成，请重试" })
        return
      }
      setMessage({ ok: true, text: "已绑定到当前账号" })
      refresh()
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  async function remove(target: string) {
    setRemoving(target)
    setMessage(null)
    try {
      const response = await fetch(`/api/account/wallets/${target}`, {
        method: "DELETE",
        credentials: "same-origin",
      })
      const json = (await response.json()) as { error?: { message?: string } }
      if (!response.ok) {
        setMessage({ ok: false, text: json.error?.message ?? "解绑失败" })
        return
      }
      setMessage({ ok: true, text: "已解绑" })
      refresh()
      router.refresh()
    } catch {
      setMessage({ ok: false, text: "解绑失败，请检查网络" })
    } finally {
      setRemoving(null)
    }
  }

  const lastCredential = wallets.length === 1 && !hasNonWalletCredential

  return (
    <Surface className={ACCOUNT_CARD_CLASS}>
      {wallets.length === 0 ? (
        <p className="text-sm text-muted-foreground">还没有绑定钱包。</p>
      ) : (
        <ul className="space-y-2">
          {wallets.map((wallet) => {
            const isCurrent = currentAddress?.toLowerCase() === wallet.address
            const isConnectedWallet =
              address && wallet.address.toLowerCase() === address.toLowerCase()
            return (
              <li
                key={wallet.address}
                className={cn(ACCOUNT_ROW_CLASS, "rounded-2xl bg-muted/40 px-3")}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <RiWallet3Line className="size-4 shrink-0 text-muted-foreground" />
                  <span className="font-mono text-xs">{short(wallet.address)}</span>
                  {isCurrent ? (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium">
                      当前登录
                    </span>
                  ) : null}
                  {isConnectedWallet && !isCurrent ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      已绑定到当前账号
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {wallet.address === rebindTarget ? (
                    <button
                      type="button"
                      onClick={() => open({ view: "Connect" })}
                      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      换绑
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={lastCredential || removing === wallet.address}
                    onClick={() => void remove(wallet.address)}
                    title={lastCredential ? "这是账号唯一的登录方式，不能解绑" : undefined}
                    className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {removing === wallet.address ? "解绑中…" : "解绑"}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!isConnected ? (
          <Button
            type="button"
            onClick={() => open({ view: "Connect" })}
            variant="outline"
            className="h-9 rounded-full px-4 text-xs font-medium"
          >
            <RiWallet3Line className="size-4" />
            连接钱包
          </Button>
        ) : alreadyBound ? null : (
          <Button
            type="button"
            onClick={() => void bind()}
            disabled={pending}
            className="h-9 rounded-full px-4 text-xs font-bold"
          >
            {pending ? (
              <RiLoader4Line className="size-4 animate-spin" />
            ) : (
              <RiShieldKeyholeLine className="size-4" />
            )}
            签署并绑定 {short(address ?? "")}
          </Button>
        )}
        {/* 放在按钮同一行而不是单独一行，避免这张卡片比上面两张高出一截 */}
        {lastCredential ? (
          <span className="text-xs leading-5 text-muted-foreground">
            唯一登录方式，解绑后将无法登入
          </span>
        ) : null}
      </div>

      {message ? (
        <p
          className={
            message.ok
              ? "inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              : "inline-flex items-center gap-1.5 text-xs text-destructive"
          }
        >
          {message.ok ? (
            <RiCheckLine className="size-3.5" />
          ) : (
            <RiErrorWarningLine className="size-3.5" />
          )}
          {message.text}
        </p>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </Surface>
  )
}
