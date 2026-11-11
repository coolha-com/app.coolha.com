"use client"

import { useCallback, useState, useSyncExternalStore } from "react"
import { useAccount, useSignMessage } from "wagmi"
import { SiweMessage } from "siwe"

interface WalletSessionState {
  address: string
  expiresAt: string
}

/**
 * 钱包登录（SIWE）客户端逻辑。
 * 连接钱包（Reown）→ 取 nonce → 签名 → 建立会话；切换钱包时按地址匹配会话状态。
 * 会话状态经 useSyncExternalStore 管理：subscribe 时拉取一次，避免 effect 内 setState。
 */

let cachedSession: WalletSessionState | null = null
let sessionLoaded = false
let sessionFetching = false
const sessionListeners = new Set<() => void>()

function notifySession() {
  sessionListeners.forEach((listener) => listener())
}

function subscribeSession(listener: () => void) {
  sessionListeners.add(listener)
  if (!sessionLoaded && !sessionFetching) {
    sessionFetching = true
    void fetch("/api/wallet-auth/session", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((json: { address: string | null; expiresAt?: string }) => {
        cachedSession = json.address
          ? { address: json.address, expiresAt: json.expiresAt ?? "" }
          : null
      })
      .catch(() => {
        cachedSession = null
      })
      .finally(() => {
        sessionFetching = false
        sessionLoaded = true
        notifySession()
      })
  }
  return () => {
    sessionListeners.delete(listener)
  }
}

function getSessionSnapshot(): WalletSessionState | null {
  return cachedSession
}

function getServerSessionSnapshot(): WalletSessionState | null {
  return null
}

export function useWalletAuth() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, getServerSessionSnapshot)
  const [error, setError] = useState<string | null>(null)

  /** 取 nonce → 签一条 SIWE 消息，供登录与绑定复用 */
  const requestSignature = useCallback(async () => {
    if (!address) throw new Error("请先连接钱包")

    const nonceResponse = await fetch(
      `/api/wallet-auth/nonce?address=${encodeURIComponent(address)}&domain=${encodeURIComponent(window.location.host)}`,
      { credentials: "same-origin" },
    )
    if (!nonceResponse.ok) {
      const json = (await nonceResponse.json()) as { error?: { message?: string } }
      throw new Error(json.error?.message ?? "获取 nonce 失败")
    }
    const { nonce } = (await nonceResponse.json()) as { nonce: string }

    const message = new SiweMessage({
      domain: window.location.host,
      address,
      statement: "Sign in to Coolha",
      uri: window.location.origin,
      version: "1",
      chainId: 1,
      nonce,
    })
    const prepared = message.toMessage()
    const signature = await signMessageAsync({ message: prepared })
    return { prepared, signature }
  }, [address, signMessageAsync])

  const signIn = useCallback(async () => {
    setError(null)
    try {
      const { prepared, signature } = await requestSignature()
      const verifyResponse = await fetch("/api/wallet-auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ message: prepared, signature }),
      })
      if (!verifyResponse.ok) {
        const json = (await verifyResponse.json()) as { error?: { message?: string } }
        throw new Error(json.error?.message ?? "签名验证失败")
      }
      const verified = (await verifyResponse.json()) as { address: string; expiresAt?: string }
      cachedSession = { address: verified.address, expiresAt: verified.expiresAt ?? "" }
      sessionLoaded = true
      notifySession()
      return verified
    } catch (signError) {
      setError(signError instanceof Error ? signError.message : "登录失败")
      return null
    }
  }, [requestSignature])

  /**
   * 把当前连接的钱包绑到已登录的账号上（不切换账号）。
   * 与 signIn 的唯一区别是带上 intent=bind，服务端据此绑定到当前 users.id 而不是按地址找人。
   */
  const bindWallet = useCallback(async () => {
    setError(null)
    try {
      const { prepared, signature } = await requestSignature()
      const response = await fetch("/api/wallet-auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ message: prepared, signature, intent: "bind" }),
      })
      const json = (await response.json()) as {
        address?: string
        expiresAt?: string
        linked?: boolean
        error?: { message?: string }
      }
      if (!response.ok) {
        throw new Error(json.error?.message ?? "绑定失败")
      }
      // 绑定同时也会建会话，这里同步本地状态，避免「已绑定但侧边栏还显示未登录」
      if (json.address) {
        cachedSession = { address: json.address, expiresAt: json.expiresAt ?? "" }
        sessionLoaded = true
        notifySession()
      }
      return json
    } catch (bindError) {
      setError(bindError instanceof Error ? bindError.message : "绑定失败")
      return null
    }
  }, [requestSignature])

  const signOut = useCallback(async () => {
    setError(null)
    try {
      await fetch("/api/wallet-auth/signout", { method: "POST", credentials: "same-origin" })
    } finally {
      cachedSession = null
      notifySession()
    }
  }, [])

  // 仅当会话地址与当前连接地址一致时视为已登录（切换钱包后需重新签名）
  const signedIn =
    isConnected &&
    session !== null &&
    address !== undefined &&
    session.address.toLowerCase() === address.toLowerCase()

  return { session, signedIn, error, signIn, bindWallet, signOut, isConnected }
}
