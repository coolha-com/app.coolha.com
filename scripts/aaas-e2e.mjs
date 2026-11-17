// AaaS 端到端验收：钱包登录 → 受控代理 → eve Runtime → OpenRouter → 模型回复 → 用量入账
// 证明四件事同时成立：Neon 可写、Creem 授权闸门可放行、eve 能执行、OpenRouter 模型能回。
//   node scripts/aaas-e2e.mjs
import { SiweMessage } from "siwe"
import { privateKeyToAccount } from "viem/accounts"
import { Client } from "eve/client"
import { readFile } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000"
const PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
const account = privateKeyToAccount(PK)
const DOMAIN = "localhost:3000"
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

let cookie = ""
function captureCookie(res) {
  const setCookie = res.headers.get("set-cookie")
  if (setCookie) cookie = setCookie.split(";")[0]
}
async function loadEnv() {
  for (const file of [".env.local", ".env.development.local"]) {
    try {
      const content = await readFile(resolve(ROOT, file), "utf8")
      for (const line of content.split("\n")) {
        const t = line.trim()
        if (!t || t.startsWith("#")) continue
        const eq = t.indexOf("=")
        if (eq <= 0) continue
        const key = t.slice(0, eq).trim()
        let value = t.slice(eq + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        if (!process.env[key]) process.env[key] = value
      }
    } catch { /* skip */ }
  }
}
function eventText(event) {
  if (event?.type !== "content.delta") return ""
  const d = event.data ?? {}
  if (d.kind === "text" && typeof d.delta === "string") return d.delta
  return ""
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  await loadEnv()
  const checks = []
  const record = (name, ok, detail = "") => {
    checks.push({ name, ok })
    console.log(`${ok ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`)
  }

  // 1. 钱包登录
  const nonceRes = await fetch(`${BASE}/api/wallet-auth/nonce?address=${account.address}&domain=${DOMAIN}`)
  const { nonce } = await nonceRes.json()
  const prepared = new SiweMessage({
    domain: DOMAIN, address: account.address, statement: "Sign in to Coolha",
    uri: `http://${DOMAIN}`, version: "1", chainId: 1, nonce,
  }).toMessage()
  const signature = await account.signMessage({ message: prepared })
  const verifyRes = await fetch(`${BASE}/api/wallet-auth/verify`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prepared, signature }),
  })
  captureCookie(verifyRes)
  record("钱包登录", verifyRes.status === 200 && cookie.length > 0, `status=${verifyRes.status}`)
  if (!cookie) throw new Error("登录失败")

  // 1b. closed 模式需要授权。按 Creem 付款成功后 grantForPaidOrder 的同等规则，
  //     给测试账号发一份临时授权（模拟收款→发授权的产物），跑完清理。
  let testOrderId = null
  if (process.env.AAAS_E2E_GRANT === "1") {
    const pg = (await import("pg")).default
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    try {
      testOrderId = `creem_e2e_${Date.now()}`
      // subject = users.id::text，按登录钱包地址反查（与 resolveSubject 同口径）
      const { rows } = await pool.query(
        `SELECT user_id::text AS subject FROM user_identities
          WHERE kind = 'evm_signing' AND address = $1 LIMIT 1`,
        [account.address.toLowerCase()])
      const subject = rows[0]?.subject ?? null
      if (subject) {
        await pool.query(
          `INSERT INTO agent_service_grants
             (id, subject, source_order_id, status, expires_at, token_budget_usd)
           VALUES ($1,$2,$3,'active', now() + interval '30 days', 10)
           ON CONFLICT (source_order_id) DO NOTHING`,
          [`grant_${testOrderId}`, subject, testOrderId])
        record("Creem 式授权已发放", true, `subject=${String(subject).slice(0, 16)}`)
      } else {
        record("Creem 式授权已发放", false, "拿不到 subject")
      }
    } finally { await pool.end() }
  }

  // 2. 先在服务端建 chat_session（closed 模式下它把授权绑到会话），拿 our session id
  let chatSessionId = null
  if (process.env.AAAS_E2E_GRANT === "1") {
    chatSessionId = `e2e_${Date.now()}`
    const createRes = await fetch(`${BASE}/api/agents/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        id: chatSessionId,
        agentId: "coolha-rwa",
        title: "AaaS 冒烟",
        config: {
          model: "deepseek/deepseek-v4.1-flash-1017",
          constraints: { readOnly: true, citeSources: true, unverifiedNotFact: true },
        },
      }),
    })
    const cj = await createRes.json()
    record("服务端会话建单并绑授权", createRes.status === 200, `status=${createRes.status} code=${cj.error?.code ?? ""}`)
    if (createRes.status !== 200) throw new Error("会话建单失败")
  }

  // 3. 通过受控代理直连 eve（/eve/v1/* 由 next.config rewrite → /api/eve/v1/*）
  const client = new Client({
    baseUrl: BASE,
    headers: () => ({
      cookie,
      "x-coolha-eve-model": "deepseek/deepseek-v4.1-flash-1017",
      ...(chatSessionId ? { "x-coolha-chat-session": chatSessionId } : {}),
    }),
  })

  // 4. eve 建会话 + 发一条真实任务（给足 token 让推理模型产出正文）
  let sessionId = null
  let reply = ""
  let sawText = false
  try {
    // create 带 message 会直接开第一轮，返回 { delivery, session }
    const created = await client.sessions.create({
      message: "请只回答一句话：你好，我是 Coolha 的测试回复。不要调用任何工具。",
      signal: AbortSignal.timeout(120000),
    })
    sessionId = created.session.id
    record("eve 创建会话并派单", Boolean(sessionId), `session=${sessionId}`)

    const delivery = created.delivery
    const eventKinds = new Set()
    for await (const event of delivery.stream()) {
      eventKinds.add(event?.type ?? "?")
      if (process.env.AAAS_E2E_DEBUG === "1" && (event?.type === "content.delta" || event?.type === "usage.recorded")) {
        console.log("  事件", event?.type, JSON.stringify(event).slice(0, 500))
      }
      const text = eventText(event)
      if (text) { reply += text; sawText = true }
    }
    if (process.env.AAAS_E2E_DEBUG === "1") {
      console.log("  事件类型:", [...eventKinds].join(", "))
    }
    record("模型返回文本", sawText && reply.trim().length > 0, `reply=${JSON.stringify(reply.trim().slice(0, 100))}`)
  } catch (error) {
    record("eve 会话与模型调用", false, `${error?.code ?? ""} ${String(error?.message ?? error).slice(0, 200)}`)
  }

  // 4. 校验用量入账（记账是代理 sidecar 异步写，轮询最多 8 秒）
  if (sessionId) {
    try {
      const pg = (await import("pg")).default
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
      let r = {}
      try {
        for (let i = 0; i < 8; i++) {
          // 代理记账的 session_id 用的是 x-coolha-chat-session（我们的会话号），非 eve 的 wrun_
          const { rows } = await pool.query(
            `SELECT count(*)::int n, max(model) model, sum(cost_usd) usd
               FROM agent_usage_ledger WHERE session_id = $1`,
            [chatSessionId ?? sessionId])
          r = rows[0] ?? {}
          if (r.n > 0) break
          await sleep(1000)
        }
        record("推理用量已入账", r.n > 0, `entries=${r.n} usd=${r.usd} model=${r.model}`)
      } finally { await pool.end() }
    } catch (error) {
      record("推理用量已入账", false, error.message)
    }
  }

  // 5. 清理测试会话（eve 侧删会话 + 账本测试行）
  if (sessionId) {
    try {
      const client2 = new Client({
        baseUrl: BASE,
        headers: () => ({ cookie, "x-coolha-eve-model": "deepseek/deepseek-v4.1-flash-1017" }),
      })
      await client2.sessions.attach(sessionId).reset()
    } catch { /* 清理失败不判失败 */ }
    try {
      const pg = (await import("pg")).default
      const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
      try {
        await pool.query(`DELETE FROM agent_usage_ledger WHERE session_id IN ($1, $2)`, [sessionId, chatSessionId ?? sessionId])
        if (testOrderId) await pool.query(`DELETE FROM agent_service_grants WHERE source_order_id = $1`, [testOrderId])
        if (chatSessionId) await pool.query(`DELETE FROM chat_sessions WHERE id = $1`, [chatSessionId])
      } finally { await pool.end() }
    } catch { /* 清理失败不判失败 */ }
    console.log(`(已清理测试会话 ${sessionId})`)
  }

  const failed = checks.filter((c) => !c.ok)
  console.log(`\n结果：${checks.length - failed.length}/${checks.length} 通过`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error("AaaS 冒烟异常:", error)
  process.exit(1)
})
