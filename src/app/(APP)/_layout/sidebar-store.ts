"use client"

import { useSyncExternalStore } from "react"

/**
 * 侧边栏显示状态：expanded（图标+文字）/ collapsed（仅图标）。
 * 宽度由用户控制而非视口断点，故不依赖 xl: 断点；模式持久化到 localStorage。
 * 移动端（<lg）不使用这两种模式，改为抽屉（drawerOpen）。
 */

export type SidebarMode = "expanded" | "collapsed"

export interface SidebarState {
  mode: SidebarMode
  drawerOpen: boolean
}

const STORAGE_KEY = "coolha.sidebar.mode"
const SERVER_STATE: SidebarState = { mode: "expanded", drawerOpen: false }

let state: SidebarState | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function readPersistedMode(): SidebarMode {
  if (typeof window === "undefined") return "expanded"
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === "expanded" || raw === "collapsed") return raw
  } catch {
    // localStorage 不可用（隐私模式等）时使用默认值
  }
  return "expanded"
}

function getState(): SidebarState {
  if (!state) state = { mode: readPersistedMode(), drawerOpen: false }
  return state
}

function setState(next: SidebarState, persist: boolean) {
  state = next
  if (persist && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next.mode)
    } catch {
      // 忽略写入失败
    }
  }
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSidebar(): SidebarState {
  return useSyncExternalStore(subscribe, getState, () => SERVER_STATE)
}

export function setSidebarMode(mode: SidebarMode) {
  const current = getState()
  if (current.mode === mode) return
  setState({ mode, drawerOpen: current.drawerOpen }, true)
}

export function toggleSidebarMode() {
  setSidebarMode(getState().mode === "expanded" ? "collapsed" : "expanded")
}

export function setSidebarDrawer(open: boolean) {
  setState({ ...getState(), drawerOpen: open }, false)
}