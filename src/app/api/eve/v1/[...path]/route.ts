import { getCurrentUser } from "@/lib/neon/session"
import {
  INFERENCE_NOT_CONFIGURED,
  isInferenceReady,
  resolveInferenceModel,
} from "@/lib/inference/config"

/**
 * 平台模型白名单：只放行统一推理网关配置里登记的模型 ID。
 * 前端只能从这份列表里选，服务端再校验一次；不接受任意字符串，更不接受 BYOK。
 * 配置来自 src/lib/inference/config.ts（唯一真相源），不再依赖 Vercel AI Gateway 目录。
 */
function resolveModel(requested: string | null): string | null {
  return resolveInferenceModel(requested)
}

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

  // 前端选中的模型经白名单校验后注入，eve 侧从已验证的 auth 属性读取
  const model = resolveModel(req.headers.get("x-coolha-eve-model"))
  if (!model) {
    return error(503, INFERENCE_NOT_CONFIGURED.code, INFERENCE_NOT_CONFIGURED.message, requestId)
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
  return new Response(upstream.body, {
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
