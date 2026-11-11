"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"

import { authClient } from "@/lib/auth-client"
import { useWalletAuth } from "@/hooks/useWalletAuth"

/**
 * 统一登录态：Web2（Neon Auth 邮箱/社交）与钱包签名登录任一成立即视为已登入。
 *
 * 会话快照放在**模块级 store** 里共享，而不是每个组件各发一次请求：
 * 侧边栏、导航栏、账户页各卡片都会调 useAuth，一次页面渲染能起五六个请求，
 * 而这些请求各自带取消标记，先挂载的会被后挂载的「取消」掉，结果谁都拿不到结果。
 *
 * 登录态的即时性靠 store 里的 signedIn，切换登录方式后调 refreshAuthSession() 重新拉。
 * 权限判定一律在服务端重新读，不信任任何客户端传入的标识。
 */

interface SessionSnapshot {
  signedIn: boolean
  source?: "web2" | "wallet"
  name?: string | null
  email?: string | null
  image?: string | null
  address?: string | null
  label?: string
}

let cached: SessionSnapshot | null = null
let inFlight: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function load(): Promise<void> {
  if (inFlight) return inFlight
  inFlight = fetch("/api/session", { credentials: "same-origin" })
    .then((response) => response.json())
    .then((json: SessionSnapshot) => {
      cached = json
    })
    .catch(() => {
      cached = { signedIn: false }
    })
    .finally(() => {
      inFlight = null
      emit()
    })
  return inFlight
}

/** 登录 / 登出 / 改资料 / 绑钱包之后调用，强制重新拉一次 */
export function refreshAuthSession(): Promise<void> {
  cached = null
  inFlight = null
  emit()
  return load()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (cached === null && !inFlight) void load()
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): SessionSnapshot | null {
  return cached
}

function getServerSnapshot(): SessionSnapshot | null {
  return null
}

export function useAuth() {
  const { data: neonSession } = authClient.useSession()
  const wallet = useWalletAuth()
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const web2User = neonSession?.user ?? null
  const walletAddress = wallet.session?.address ?? null
  const ready = snapshot !== null

  // 登录方式变了就重新拉一次展示资料（首次挂载时 subscribe 里已经拉过，这里只处理「之后的变化」）
  useEffect(() => {
    if (walletAddress) void refreshAuthSession()
  }, [walletAddress])

  const signedIn = ready ? Boolean(snapshot?.signedIn) : Boolean(web2User) || wallet.signedIn

  const signOut = useCallback(async () => {
    if (web2User) {
      await authClient.signOut().catch(() => undefined)
    }
    await wallet.signOut().catch(() => undefined)
    await refreshAuthSession()
  }, [web2User, wallet])

  const name = snapshot?.name ?? web2User?.name ?? null
  const email = snapshot?.email ?? web2User?.email ?? null
  const image = snapshot?.image ?? web2User?.image ?? null
  const address = snapshot?.address ?? walletAddress
  const label = name?.trim() || email?.trim() || (address ? shortAddress(address) : "")

  return {
    signedIn,
    /** 会话快照是否已就绪（首帧用它避免把「已登录」闪成「登入」） */
    ready,
    source:
      snapshot?.source ??
      (web2User ? ("web2" as const) : wallet.signedIn ? ("wallet" as const) : null),
    email,
    name,
    image,
    address,
    label,
    refresh: refreshAuthSession,
    signOut,
  }
}

export function shortAddress(address?: string | null): string {
  if (!address) return ""
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
