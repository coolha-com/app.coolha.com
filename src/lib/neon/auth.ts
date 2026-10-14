import { createNeonAuth } from "@neondatabase/auth/next/server"

/**
 * Neon Managed Better Auth（服务端）。
 * 用户与会话存储于分支的 neon_auth schema；与现有 Reown 钱包连接并存，互不影响。
 * 未配置相关环境变量时所有方法返回 null，路由层据此返回 503。
 */

type NeonAuthInstance = ReturnType<typeof createNeonAuth>

let cached: NeonAuthInstance | null = null

export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET)
}

export function getAuth(): NeonAuthInstance | null {
  if (!isAuthConfigured()) return null
  if (!cached) {
    cached = createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL!,
      cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
    })
  }
  return cached
}
