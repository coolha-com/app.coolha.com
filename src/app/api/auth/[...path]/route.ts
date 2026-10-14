import type { NextRequest } from "next/server"
import { getAuth } from "@/lib/neon/auth"

/**
 * Neon Managed Better Auth catch-all 路由。
 * 依据 neon-auth skill：auth.handler() 转发全部五个方法到托管 Auth，
 * 签名为 (request, { params: Promise<{ path: string[] }> })。
 * 未配置时返回 503，不影响站点其他路由。
 */

type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

type AuthRouteHandler = (
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) => Promise<Response>

function unavailable(): Response {
  return Response.json(
    {
      error: {
        code: "AUTH_NOT_CONFIGURED",
        message:
          "Neon Managed Auth 未配置（缺少 NEON_AUTH_BASE_URL 或 NEON_AUTH_COOKIE_SECRET）",
      },
    },
    { status: 503 },
  )
}

async function forward(method: Method, request: NextRequest, path: string[]): Promise<Response> {
  const auth = getAuth()
  if (!auth) return unavailable()
  const handlers = auth.handler() as unknown as Partial<Record<Method, AuthRouteHandler>>
  const handler = handlers[method]
  if (!handler) return unavailable()
  return handler(request, { params: Promise.resolve({ path }) })
}

type RouteContext = { params: Promise<{ path: string[] }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return forward("GET", request, path)
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return forward("POST", request, path)
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return forward("PUT", request, path)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return forward("DELETE", request, path)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  return forward("PATCH", request, path)
}
