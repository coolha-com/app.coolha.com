"use client"

import { useSyncExternalStore } from "react"

/**
 * 订阅状态（当前档位 + 订单 + 流水）的模块级外部存储。
 *
 * 与 `useWalletAuth` / `useConnections` 同一套模式：拉取发生在 `subscribe` 里，
 * 而不是组件 effect 体内 setState —— 避免 effect 内同步 setState 引起的级联渲染。
 */

export interface OrderView {
  id: string
  plan: string
  chain: string
  token: string
  payTo: string
  amountToken: string
  status: string
  expiresAt: string
}

export interface LedgerView {
  id: string
  kind: string
  amountUsd: string
  plan: string | null
  memo: string | null
  createdAt: string
}

export interface SubscriptionStatus {
  signedIn: boolean
  plan: string
  planName: string
  orders: OrderView[]
  ledger: LedgerView[]
}

let cache: SubscriptionStatus | null = null
let loaded = false
let fetching = false
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!loaded && !fetching) {
    fetching = true
    void fetch("/api/subscription/orders", { credentials: "same-origin" })
      .then((response) => response.json())
      .then((json: SubscriptionStatus) => {
        cache = json
      })
      .catch(() => {
        cache = null
      })
      .finally(() => {
        fetching = false
        loaded = true
        notify()
      })
  }
  return () => {
    listeners.delete(listener)
  }
}

function readSnapshot(): SubscriptionStatus | null {
  return cache
}

function readServerSnapshot(): SubscriptionStatus | null {
  return null
}

export function useSubscriptionStatus(): SubscriptionStatus | null {
  return useSyncExternalStore(subscribe, readSnapshot, readServerSnapshot)
}

/** 主动重新拉取（订阅动作、手动刷新、登录状态变化后调用） */
export async function reloadSubscriptionStatus(): Promise<void> {
  try {
    const response = await fetch("/api/subscription/orders", { credentials: "same-origin" })
    const json = (await response.json()) as SubscriptionStatus
    cache = json
  } catch {
    cache = null
  }
  loaded = true
  notify()
}
