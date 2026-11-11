// 真实推理计量端到端验证：对话 → eve 调用模型 → 代理层解析 usage.recorded → 落 Neon 账本
//
// 关键链路：
//   浏览器 → /eve/v1/session/{id}/stream → Next 受控代理（tee 一份）→ eve Runtime → OpenRouter
//   代理从流里解析 usage.recorded（inputTokens/outputTokens），按 OpenRouter 单价换算成美元，
//   记进 agent_usage_ledger 并累加到这份服务授权的已用额度上。
//
//   node scripts/metering-smoke.mjs
import { SiweMessage } from "siwe"
import { privateKeyToAccount } from "viem/accounts"
import pg from "pg"
import { readFile, access } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000"
const PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
const account = privateKeyToAccount(PK)
const DOMAIN = "localhost:3000"
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const checks = []
function record(name, ok, detail = "") {
  checks.push({ name, ok })
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`)
}

let cookie = ""
function captureCookie(res) {
  const setCookie = res.headers.get("set-cookie")
  if (setCookie) cookie = setCookie.split(";")[0]
}
const H = () => ({ "Content-Type": "application/json", cookie })

async function loadEnv() {
  for (const file of [".env.local", ".env.development.local"]) {
    try {
      const path = resolve(ROOT, file)
      await access(path)
      const content = await readFile(path, "utf8")
      for (const line of content.split("\n")) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#")) continue
        const eq = trimmed.indexOf("=")
        if (eq <= 0) continue
        const key = trimmed.slice(0, eq).trim()
        let value = trimmed.slice(eq + 1).trim()
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1)
        }
        process.env[key] = value
      }
    } catch {
      // 文件不存在则跳过
    }
  }
}

async function main() {
  // 1. 登录
  const nonceRes = await fetch(
    `${BASE}/api/wallet-auth/nonce?address=${account.address}&domain=${DOMAIN}`,
  )
  const { nonce } = await nonceRes.json()
  const prepared = new SiweMessage({
    domain: DOMAIN,
    address: account.address,
    statement: "Sign in to Coolha",
    uri: `http://${DOMAIN}`,
    version: "1",
    chainId: 1,
    nonce,
  }).toMessage()
  const signature = await account.signMessage({ message: prepared })
  const verifyRes = await fetch(`${BASE}/api/wallet-auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prepared, signature }),
  })
  captureCookie(verifyRes)
  record("钱包登录", verifyRes.status === 200 && cookie.length > 0)

  // 2. 发放授权 + 建会话（会话绑定授权）
  const grantRes = await fetch(`${BASE}/api/agents/credits/test-grant`, { method: "POST", headers: H() })
  const grantBody = await grantRes.json()
  const grantId = grantBody?.grantId
  record("发放服务授权", grantRes.status === 200 && Boolean(grantId), grantId)

  const sessionId = `meter_smoke_${Date.now()}`
  const createRes = await fetch(`${BASE}/api/agents/sessions`, {
    method: "POST",
    headers: H(),
    body: JSON.stringify({ id: sessionId, agentId: "coolha-rwa", title: "计量冒烟" }),
  })
  record("创建会话（绑定授权）", createRes.status === 200, `status=${createRes.status}`)

  // 3. 通过我们的代理走一遍真实推理
  const createEve = await fetch(`${BASE}/eve/v1/session`, {
    method: "POST",
    headers: { ...H(), "x-coolha-chat-session": sessionId },
    body: "{}",
  })
  const eveSession = await createEve.json()
  record("经代理创建 eve 会话", createEve.status === 202 && Boolean(eveSession.sessionId), eveSession.sessionId)

  const sendRes = await fetch(`${BASE}/eve/v1/session/${eveSession.sessionId}`, {
    method: "POST",
    headers: { ...H(), "x-coolha-chat-session": sessionId },
    body: JSON.stringify({ message: "用一句话介绍你能提供的服务。" }),
  })
  record("经代理投递用户消息", sendRes.status < 400, `status=${sendRes.status}`)

  // 4. 读流（代理在这里 tee 并计量）
  const streamRes = await fetch(
    `${BASE}/eve/v1/session/${eveSession.sessionId}/stream?startIndex=0`,
    { headers: { cookie, "x-coolha-chat-session": sessionId } },
  )
  record("经代理打开事件流", streamRes.status === 200, `status=${streamRes.status}`)

  let sawUsage = false
  let sawText = false
  const reader = streamRes.body.getReader()
  const decoder = new TextDecoder()
  const deadline = Date.now() + 90_000
  let buffer = ""
  while (Date.now() < deadline) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    if (buffer.includes("usage.recorded")) sawUsage = true
    if (buffer.includes("content.delta")) sawText = true
    if (sawUsage && sawText) break
  }
  await reader.cancel().catch(() => {})
  record("事件流里出现 usage.recorded 与内容增量", sawUsage && sawText, `usage=${sawUsage} text=${sawText}`)

  // 5. 账本里应有这次推理的用量
  await loadEnv()
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  })
  await client.connect()
  await new Promise((r) => setTimeout(r, 1500))
  const ledger = await client.query(
    `SELECT input_tokens, output_tokens, cost_usd, model FROM agent_usage_ledger
      WHERE grant_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [grantId],
  )
  const row = ledger.rows[0]
  record(
    "账本记录到 token 数",
    Boolean(row) && Number(row.input_tokens) > 0 && Number(row.output_tokens) > 0,
    row ? `in=${row.input_tokens} out=${row.output_tokens}` : "无记录",
  )
  record(
    "按 OpenRouter 单价换算出成本",
    row?.cost_usd !== null && row?.cost_usd !== undefined && Number(row.cost_usd) > 0,
    row ? `cost=$${row.cost_usd} model=${row.model}` : "无成本",
  )

  const grant = await client.query(
    `SELECT token_used_usd, status FROM agent_service_grants WHERE id = $1`,
    [grantId],
  )
  record(
    "用量已累加到授权额度",
    Number(grant.rows[0]?.token_used_usd ?? 0) > 0,
    `used=$${grant.rows[0]?.token_used_usd}`,
  )

  // 6. 清理
  await client.query(`DELETE FROM agent_usage_ledger WHERE grant_id = $1`, [grantId])
  await client.query(`DELETE FROM agent_service_grants WHERE id = $1`, [grantId])
  await client.query(`DELETE FROM chat_sessions WHERE id = $1`, [sessionId])
  await client.query(`DELETE FROM waffo_orders WHERE id = $1`, [grantBody?.orderId])
  await client.end()

  const pass = checks.every((c) => c.ok)
  console.log(pass ? "METERING_RESULT: ALL_PASS" : "METERING_RESULT: FAIL")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error("METERING_ERROR:", e.message)
  process.exit(1)
})
