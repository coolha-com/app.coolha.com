import { createSIWEConfig } from "@reown/appkit-siwe"
import { SiweMessage } from "siwe"

/**
 * AppKit One-Click Auth（连接 + 签名统一流程）配置。
 *
 * 由环境变量 NEXT_PUBLIC_SIWE_ONECLICK=1 启用；未设置时导出 undefined，
 * createAppKit 行为与未接入完全一致（不断链的安全默认）。
 *
 * 设计约束（上次事故的修复）：
 * - getSession 返回真实 chainId（会话表记录，不再硬编码），避免 AppKit 判定会话失效
 * - 除 getNonce 外所有回调永不抛出：任何失败都降级为「已连接未登录」，不中断连接流程
 * - required: false：用户拒绝签名后保持连接，可后续重试
 */

const DEFAULT_CHAIN_ID = 1

function currentDomain(): string {
  return typeof window === "undefined" ? "localhost" : window.location.host
}

function currentOrigin(): string {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin
}

async function fetchNonceWithRetry(address?: string): Promise<string> {
  const params = new URLSearchParams({ domain: currentDomain() })
  if (address) params.set("address", address)
  let lastError: unknown = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`/api/wallet-auth/nonce?${params.toString()}`, {
        credentials: "same-origin",
      })
      if (!response.ok) throw new Error(`nonce endpoint ${response.status}`)
      const { nonce } = (await response.json()) as { nonce: string }
      return nonce
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error("nonce 获取失败")
}

function buildSiweConfig() {
  return createSIWEConfig({
    getMessageParams: async () => ({
      domain: currentDomain(),
      uri: currentOrigin(),
      chains: [DEFAULT_CHAIN_ID],
      statement: "Sign in to Coolha",
    }),

    getNonce: (address?: string) => fetchNonceWithRetry(address),

    createMessage: (args) =>
      new SiweMessage({
        domain: args.domain,
        address: args.address,
        statement: args.statement ?? "Sign in to Coolha",
        uri: args.uri,
        version: "1",
        chainId: args.chainId,
        nonce: args.nonce,
      }).toMessage(),

    verifyMessage: async ({ message, signature }) => {
      try {
        const response = await fetch("/api/wallet-auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ message, signature }),
        })
        return response.ok
      } catch {
        return false
      }
    },

    getSession: async () => {
      try {
        const response = await fetch("/api/wallet-auth/session", { credentials: "same-origin" })
        if (!response.ok) return null
        const json = (await response.json()) as {
          address: string | null
          chainId?: number
        }
        return json.address
          ? { address: json.address, chainId: json.chainId ?? DEFAULT_CHAIN_ID }
          : null
      } catch {
        return null
      }
    },

    signOut: async () => {
      try {
        await fetch("/api/wallet-auth/signout", { method: "POST", credentials: "same-origin" })
      } catch {
        // 忽略：本地无会话时静默
      }
      return true
    },

    // 取消签名后保持钱包连接，不断链
    required: false,
    enabled: true,
    signOutOnDisconnect: true,
    signOutOnAccountChange: true,
    signOutOnNetworkChange: false,
  })
}

export const siweConfig =
  process.env.NEXT_PUBLIC_SIWE_ONECLICK === "1" ? buildSiweConfig() : undefined
