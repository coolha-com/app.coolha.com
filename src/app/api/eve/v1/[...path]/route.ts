import { getCurrentUser } from "@/lib/neon/session"
import {
  INFERENCE_NOT_CONFIGURED,
  isInferenceReady,
  resolveInferenceModel,
} from "@/lib/inference/config"
import { classifyUpstreamStatus } from "@/lib/inference/upstream"
import { decideAgentAccess } from "@/lib/agents/access-mode"
import { grantForSession, readOpenModeBudget } from "@/lib/neon/agent-billing"
import { teeAndMeterUsage } from "@/lib/agents/usage-meter"

/**
 * 平台模型白名单：只放行统一推理网关配置里登记的模型 ID。
 * 显式传入白名单外的 ID 直接拒绝，不静默换成默认模型。
 * 不读客户端提交的访问模式，也不接受用户自带密钥。
 */

/**
 * eve Runtime 的受控代理：只有 Coolha 签名登录用户能派任务。
 *
 * 浏览器 → /eve/v1/*（同源 rewrite）→ 本路由 → eve Runtime。
 * 本路由复用项目既有的 SIWE 会话校验（coolha_wallet_session → wallet_sessions 表），
 * 校验通过后注入内部共享密钥与 subject，再转发；用户 cookie 不下行给 eve。
 * eve 侧的 route auth 只认这个内部密钥，因此无法绕过主站直连 Runtime。
 *
 * 本地开发有占位默认值；生产必须显式设置 EVE_INTERNAL_SECRET 与
 * EVE_RUNTIME_ORIGIN，否则 503（fail-closed）。
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEV_SECRET = "coolha-local-eve-proxy"
const DEV_ORIGIN = "http://127.0.0.1:4274"

// `next start` 本地也是 NODE_ENV=production，只看 NODE_ENV 会让本地链路拿不到
// 默认密钥/地址。COOLHA_EVE_LOCAL=1 是纯本地开关（只写 .env.local，禁止同步到
// Vercel），与 eve 侧 agent/channels/eve.ts 的判定一致；云端没有它，生产仍
// fail-closed（必须显式配置 EVE_RUNTIME_ORIGIN + EVE_INTERNAL_SECRET）。
function localEve(): boolean {
  return (
    process.env.COOLHA_EVE_LOCAL === "1" ||
    process.env.NODE_ENV !== "production"
  )
}

function internalSecret(): string | null {
  return process.env.EVE_INTERNAL_SECRET ?? (localEve() ? DEV_SECRET : null)
}

function runtimeOrigin(): string | null {
  return process.env.EVE_RUNTIME_ORIGIN ?? (localEve() ? DEV_ORIGIN : null)
}

function error(status: number, code: string, message: string, requestId: string) {
  return Response.json({ error: { code, message, requestId } }, { status })
}

async function proxy(
  req: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const requestId = `eve_${crypto.randomUUID()}`

  // 地理合规二次防御：proxy.ts 已对 hard-block 地区做过拦截，这里不绕过。
  if (req.headers.get("x-coolha-geo-access-tier") === "hard-block") {
    return error(451, "SERVICE_UNAVAILABLE_IN_YOUR_REGION", "当前地区暂不支持该服务", requestId)
  }

  // ① 身份：Web2 登录（Neon Auth）或钱包签名登录，统一成同一个 users.id
  const user = await getCurrentUser()
  if (!user) {
    return error(401, "SIGN_IN_REQUIRED", "请先登入后再派发任务", requestId)
  }

  const secret = internalSecret()
  const origin = runtimeOrigin()
  if (!secret || !origin) {
    return error(503, "AGENT_RUNTIME_NOT_CONFIGURED", "Agent Runtime 未配置", requestId)
  }

  // ② 推理网关未接入时提前 fail-closed，不把请求转到 Runtime 再失败
  if (!isInferenceReady()) {
    return error(503, INFERENCE_NOT_CONFIGURED.code, INFERENCE_NOT_CONFIGURED.message, requestId)
  }

  // 前端选中的模型经白名单校验后注入，eve 侧从已验证的 auth 属性读取。
  // 访问模式只看服务端环境变量，忽略 query / header 里的同名开关。
  const resolved = resolveInferenceModel(req.headers.get("x-coolha-eve-model"))
  if (!resolved.ok) {
    if (resolved.reason === "not_allowed") {
      return error(403, "MODEL_NOT_ALLOWED", "该模型不在服务端白名单内", requestId)
    }
    return error(503, INFERENCE_NOT_CONFIGURED.code, INFERENCE_NOT_CONFIGURED.message, requestId)
  }
  const model = resolved.modelId

  // ③ 执行闸门。开放测试模式不要求购买，但仍记账并受测试预算限制。
  //    关闭模式必须有一份仍有效的服务授权。生产环境无法通过请求变成开放模式。
  const access = decideAgentAccess()
  const chatSessionId = req.headers.get("x-coolha-chat-session")
  let grantId: string | null = null
  if (access.open) {
    const budget = await readOpenModeBudget(user.subject)
    if (budget.reason === "unavailable") {
      return error(503, "BUDGET_UNAVAILABLE", "暂时无法确认测试预算，已拒绝本次执行", requestId)
    }
    if (budget.blocked) {
      return error(
        402,
        "QUOTA_EXHAUSTED",
        "开发测试预算已用完。用量仍会记账，但在预算恢复前不再调用模型。",
        requestId,
      )
    }
  } else {
    if (!chatSessionId) {
      return error(
        402,
        "PAYMENT_REQUIRED",
        "当前环境未开放未经授权的 Agent 执行",
        requestId,
      )
    }
    const grant = await grantForSession(chatSessionId, user.subject)
    if (!grant) {
      return error(
        402,
        "PAYMENT_REQUIRED",
        "这次对话没有有效的服务授权，当前环境未开放测试执行",
        requestId,
      )
    }
    const expired = new Date(grant.expiresAt).getTime() <= Date.now()
    const exhausted = grant.tokenUsedUsd >= grant.tokenBudgetUsd
    if (expired || exhausted || grant.status !== "active") {
      return error(
        402,
        expired ? "GRANT_EXPIRED" : "QUOTA_EXHAUSTED",
        expired
          ? "这份服务授权已过期"
          : "这份服务授权的成本护栏已用完",
        requestId,
      )
    }
    grantId = grant.id
  }

  const { path } = await context.params
  const url = new URL(req.url)
  const target = `${origin}/eve/v1/${path.map(encodeURIComponent).join("/")}${url.search}`

  const headers = new Headers(req.headers)
  headers.delete("host")
  headers.delete("cookie")
  headers.delete("authorization")
  headers.set("x-coolha-eve-secret", secret)
  headers.set("x-coolha-subject", user.subject)
  headers.set("x-coolha-eve-model", model)

  const hasBody = req.method !== "GET" && req.method !== "HEAD"
  const init = {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    ...(hasBody ? { duplex: "half" } : {}),
  } as RequestInit

  let upstream: Response
  try {
    upstream = await fetch(target, init)
  } catch {
    return error(502, "AGENT_RUNTIME_UNREACHABLE", "Agent Runtime 暂不可用", requestId)
  }

  const responseHeaders = new Headers(upstream.headers)
  responseHeaders.set("x-coolha-request-id", requestId)
  const upstreamFailure = classifyUpstreamStatus(upstream.status)
  if (upstreamFailure) {
    responseHeaders.set("x-coolha-upstream-code", upstreamFailure.code)
  }
  if (!upstream.body) {
    if (upstreamFailure) {
      return error(upstream.status, upstreamFailure.code, upstreamFailure.message, requestId)
    }
    return new Response(null, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  }
  // 只有成功的事件流才记账，避免把上游错误响应记成一次成功调用。
  const body =
    upstream.status >= 200 && upstream.status < 300
      ? teeAndMeterUsage(upstream.body, {
          subject: user.subject,
          grantId,
          sessionId: chatSessionId,
          fallbackModelId: model,
          requestId,
        })
      : upstream.body
  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
}
