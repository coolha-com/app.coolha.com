"use client"

import { createAuthClient } from "@neondatabase/auth/next"

/**
 * Neon Auth（Managed Better Auth）浏览器端客户端。
 *
 * 服务端由 `src/lib/neon/auth.ts` 的 `createNeonAuth()` 承接，路由在 `/api/auth/[...path]`，
 * 客户端 baseURL 默认就是同源 `/api/auth`（不传 url 即可），因此会话 Cookie 是第一方的，
 * 不需要跨域、不需要 iframe。
 *
 * 能力范围由 Neon 控制台的 Auth 配置决定（当前：邮箱验证码 + 共享 Google）。
 * 前端不做能力猜测——按钮点了报错要如实显示，不能假装「即将上线」。
 */
export const authClient = createAuthClient()
