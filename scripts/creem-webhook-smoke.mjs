// Webhook 冒烟：签名校验 → checkout.completed 发授权 → 重投幂等 → refund 作废 → 清理
// 用环境变量 CREEM_WEBHOOK_SECRET 作为临时签名密钥（与测试 server 注入值一致）。
// 所有测试数据（订单/授权/事件）跑完自动删除。
import { SiweMessage } from "siwe"
import { privateKeyToAccount } from "viem/accounts"
import { createHmac } from "node:crypto"
import pg from "pg"
import { readFile } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000"
const SECRET = process.env.CREEM_WEBHOOK_SECRET ?? ""
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
    } catch {
      // skip
    }
  }
}
async function sendWebhook(body, sigOverride) {
  const raw = JSON.stringify(body)
  const sig = sigOverride ?? createHmac("sha256", SECRET).update(raw).digest("hex")
  const res = await fetch(`${BASE}/api/creem/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "creem-signature": sig },
    body: raw,
  })
  return { status: res.status, json: await res.json() }
}

async function main() {
  await loadEnv()
  if (!SECRET) throw new Error("需要 CREEM_WEBHOOK_SECRET 环境变量")

  const checks = []
  const record = (name, ok, detail = "") => {
    checks.push({ name, ok })
    console.log(`${ok ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`)
  }

  // 钱包登录
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

  // 建单拿 orderId
  const createRes = await fetch(`${BASE}/api/creem/checkout`, {
    method: "POST", headers: { "Content-Type": "application/json", cookie, origin: BASE },
  })
  const { orderId } = await createRes.json()
  record("建单", createRes.status === 200 && Boolean(orderId), `orderId=${orderId}`)
  if (!orderId) throw new Error("建单失败")

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  let subject = null
  let realCheckoutId = null
  try {
    const { rows } = await pool.query(
      `SELECT subject, checkout_id FROM creem_orders WHERE id = $1`, [orderId])
    subject = rows[0]?.subject ?? null
    realCheckoutId = rows[0]?.checkout_id ?? null
  } finally {
    // 保持 pool 复用，最后统一关
  }

  // 必须用建单时落库的真实 checkout_id，否则会命中串单防护（这正是防护该有的行为）
  const baseObject = {
    id: realCheckoutId ?? "ch_smoke_" + Date.now(),
    request_id: orderId,
    status: "completed",
    order: { id: "ord_smoke", transaction: "tran_smoke", amount_paid: 1900, currency: "USD", status: "paid" },
    customer: { id: "cust_smoke", email: "smoke@example.com" },
    subscription: null,
    metadata: { subject, orderId, source: "coolha_creem_test" },
  }
  const completed = { id: "evt_smoke_" + Date.now(), eventType: "checkout.completed", created_at: Date.now(), object: baseObject }

  // 1. 错签名必须 401
  const bad = await sendWebhook(completed, "deadbeef")
  record("错签名返回 401", bad.status === 401, `status=${bad.status}`)

  // 2. 正确签名 → 发授权
  const ok = await sendWebhook(completed)
  record("checkout.completed 核销", ok.status === 200 && ok.json?.result?.status === "granted", `result=${ok.json?.result?.status}`)

  // 3. 校验订单 paid + 授权存在
  const grantId = `grant_${orderId}`
  const { rows: afterPaid } = await pool.query(
    `SELECT o.status, o.grant_id, g.id AS gid, g.subject FROM creem_orders o
     LEFT JOIN agent_service_grants g ON g.id = o.grant_id WHERE o.id = $1`, [orderId])
  record("订单迁入 paid 且授权发放", afterPaid[0]?.status === "paid" && afterPaid[0]?.gid === grantId && afterPaid[0]?.subject === subject,
    `status=${afterPaid[0]?.status} grant=${afterPaid[0]?.gid}`)

  // 4. 重投 → duplicate（幂等）
  const dup = await sendWebhook(completed)
  record("重投幂等不重复发授权", dup.status === 200 && dup.json?.result?.status === "duplicate", `result=${dup.json?.result?.status}`)
  const { rows: grantCount } = await pool.query(`SELECT count(*)::int AS n FROM agent_service_grants WHERE source_order_id = $1`, [orderId])
  record("授权只有一份", grantCount[0]?.n === 1, `count=${grantCount[0]?.n}`)

  // 5. 退款 → 作废授权
  const refund = { id: "evt_refund_" + Date.now(), eventType: "refund.created", created_at: Date.now(),
    object: { request_id: orderId, order: { id: "ord_smoke" } } }
  const refRes = await sendWebhook(refund)
  record("refund.created 作废", refRes.status === 200 && refRes.json?.result?.status === "revoked", `result=${refRes.json?.result?.status}`)
  const { rows: afterRefund } = await pool.query(
    `SELECT o.status, g.status AS gstatus FROM creem_orders o
     LEFT JOIN agent_service_grants g ON g.id = o.grant_id WHERE o.id = $1`, [orderId])
  record("订单 refunded 且授权作废", afterRefund[0]?.status === "refunded" && afterRefund[0]?.gstatus === "refunded",
    `order=${afterRefund[0]?.status} grant=${afterRefund[0]?.gstatus}`)

  // 6. 清理所有测试数据
  try {
    await pool.query(`DELETE FROM creem_webhook_events WHERE order_id = $1`, [orderId])
    await pool.query(`DELETE FROM agent_service_grants WHERE source_order_id = $1`, [orderId])
    await pool.query(`DELETE FROM agent_usage_ledger WHERE grant_id = $1`, [grantId])
    await pool.query(`DELETE FROM creem_orders WHERE id = $1`, [orderId])
    record("清理测试数据", true)
  } catch (error) {
    record("清理测试数据", false, error.message)
  } finally {
    await pool.end()
  }

  const failed = checks.filter((c) => !c.ok)
  console.log(`\n结果：${checks.length - failed.length}/${checks.length} 通过`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error("Webhook 冒烟异常:", error)
  process.exit(1)
})
