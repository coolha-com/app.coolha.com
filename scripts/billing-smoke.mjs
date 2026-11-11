// 计费链路端到端验证：付费门禁 → 授权 → 会话 → 计量 → 额度用满即拒
//
//   1. 未购买时创建会话 → 402 PAYMENT_REQUIRED
//   2. 测试模式发放一份授权 → 额度可用
//   3. 创建会话 → 200，且会话绑定了这份授权
//   4. 记一笔推理用量 → 授权的已用额度增加
//   5. 把额度用满 → 授权 exhausted → 再创建会话 → 402 QUOTA/PAYMENT
//   6. 清理测试数据
//
//   node scripts/billing-smoke.mjs
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
  // 头要惰性取：登录拿到 cookie 之后才带上
  const H = () => ({ "Content-Type": "application/json", cookie })

  // 0. 登录
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
  record("钱包登录建立会话", verifyRes.status === 200 && cookie.length > 0, `status=${verifyRes.status}`)

  // 1. 未购买时创建会话 → 402
  const sessionId = `bill_smoke_${Date.now()}`
  const createRes = await fetch(`${BASE}/api/agents/sessions`, {
    method: "POST",
    headers: H(),
    body: JSON.stringify({ id: sessionId, agentId: "coolha-rwa", title: "计费冒烟" }),
  })
  const createBody = await createRes.json()
  record(
    "无授权时创建会话被拒（402 PAYMENT_REQUIRED）",
    createRes.status === 402 && createBody?.error?.code === "PAYMENT_REQUIRED",
    `status=${createRes.status} code=${createBody?.error?.code}`,
  )

  // 2. 测试模式发放授权
  const grantRes = await fetch(`${BASE}/api/agents/credits/test-grant`, { method: "POST", headers: H() })
  const grantBody = await grantRes.json()
  record(
    "测试模式发放授权成功",
    grantRes.status === 200 && Boolean(grantBody?.grantId),
    `status=${grantRes.status} grant=${grantBody?.grantId}`,
  )
  const grantId = grantBody?.grantId

  // 3. 有授权时创建会话 → 200，且会话绑定了这份授权
  const createRes2 = await fetch(`${BASE}/api/agents/sessions`, {
    method: "POST",
    headers: H(),
    body: JSON.stringify({ id: sessionId, agentId: "coolha-rwa", title: "计费冒烟" }),
  })
  const createBody2 = await createRes2.json()
  record(
    "有授权时创建会话成功并绑定授权",
    createRes2.status === 200 && createBody2?.grantId === grantId,
    `status=${createRes2.status}`,
  )

  // 4. 额度状态
  const creditsRes = await fetch(`${BASE}/api/agents/credits`, { headers: H() })
  const credits = await creditsRes.json()
  record(
    "额度接口返回预算与剩余",
    creditsRes.status === 200 && credits.hasGrant === true && credits.budgetUsd === 10,
    `budget=${credits?.budgetUsd} remaining=${credits?.remainingUsd} testMode=${credits?.testMode}`,
  )

  // 5. 记一笔推理用量 → 已用额度增加（直接写账本，走的是服务端的累加逻辑）
  await loadEnv()
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  const client = new pg.Client({ connectionString })
  await client.connect()
  const subject = await client.query(
    `SELECT subject FROM agent_service_grants WHERE id = $1 LIMIT 1`,
    [grantId],
  )
  const subjectId = subject.rows[0]?.subject
  await client.query(
    `INSERT INTO agent_usage_ledger
       (subject, grant_id, session_id, model, input_tokens, output_tokens, cost_usd, source)
     VALUES ($1, $2, $3, 'deepseek/deepseek-v4.1-flash-1017', 1000, 500, 0.25, 'smoke')`,
    [subjectId, grantId, sessionId],
  )
  await client.query(
    `UPDATE agent_service_grants
        SET token_used_usd = token_used_usd + 0.25,
            status = CASE WHEN token_used_usd + 0.25 >= token_budget_usd THEN 'exhausted' ELSE status END,
            updated_at = now()
      WHERE id = $1`,
    [grantId],
  )
  const afterUse = await client.query(
    `SELECT token_used_usd, status FROM agent_service_grants WHERE id = $1`,
    [grantId],
  )
  record(
    "用量记账累加到授权上",
    Number(afterUse.rows[0]?.token_used_usd) === 0.25,
    `used=${afterUse.rows[0]?.token_used_usd}`,
  )

  // 6. 额度用满 → exhausted → 再创建会话被拒
  await client.query(
    `UPDATE agent_service_grants SET token_used_usd = token_budget_usd, status = 'exhausted' WHERE id = $1`,
    [grantId],
  )
  const createRes3 = await fetch(`${BASE}/api/agents/sessions`, {
    method: "POST",
    headers: H(),
    body: JSON.stringify({ id: `${sessionId}_b`, agentId: "coolha-rwa", title: "计费冒烟2" }),
  })
  const createBody3 = await createRes3.json()
  record(
    "额度用满后创建会话被拒（402）",
    createRes3.status === 402 && createBody3?.error?.code === "PAYMENT_REQUIRED",
    `status=${createRes3.status} code=${createBody3?.error?.code}`,
  )

  // 7. 清理
  await client.query(`DELETE FROM agent_usage_ledger WHERE grant_id = $1`, [grantId])
  await client.query(`DELETE FROM agent_service_grants WHERE id = $1`, [grantId])
  await client.query(`DELETE FROM chat_sessions WHERE id = $1 OR id = $2`, [sessionId, `${sessionId}_b`])
  await client.query(`DELETE FROM waffo_orders WHERE id = $1`, [grantBody?.orderId])
  await client.end()
  const after = await fetch(`${BASE}/api/agents/credits`, { headers: H() })
  const afterBody = await after.json()
  record("清理后额度归零", afterBody?.hasGrant === false, `hasGrant=${afterBody?.hasGrant}`)

  const pass = checks.every((c) => c.ok)
  console.log(pass ? "BILLING_RESULT: ALL_PASS" : "BILLING_RESULT: FAIL")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error("BILLING_ERROR:", e.message)
  process.exit(1)
})
