/**
 * Waffo webhook 端到端验证（真实沙箱支付）。
 *
 * 流程：
 *   1. SIWE 登录拿到会话 cookie
 *   2. 调我们自己的 POST /api/waffo/checkout → 建 pending 订单 + 拿到收银台 URL
 *   3. 用测试卡走完沙箱支付（需要人工在浏览器完成，或由调用方传入已完成）
 *   4. 查 Waffo 侧 webhookDeliveries 的 httpStatus
 *   5. 查我们库里的订单状态与授权发放结果
 *
 * 用法：node scripts/waffo-e2e.mjs <checkoutUrl>
 */
import { readFile } from "node:fs/promises"
import pg from "pg"
import { SiweMessage } from "siwe"
import { privateKeyToAccount } from "viem/accounts"

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const DOMAIN = "localhost:3000"
const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

async function loadEnv() {
  for (const file of [".env.local", ".env.development.local"]) {
    let content
    try {
      content = await readFile(file, "utf8")
    } catch {
      continue
    }
    for (const line of content.split("\n")) {
      const t = line.trim()
      if (!t || t.startsWith("#")) continue
      const e = t.indexOf("=")
      if (e <= 0) continue
      const key = t.slice(0, e).trim()
      let value = t.slice(e + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (key && !process.env[key]) process.env[key] = value
    }
  }
}

async function signIn() {
  const account = privateKeyToAccount(TEST_KEY)
  const nonce = (
    await (
      await fetch(`${BASE}/api/wallet-auth/nonce?address=${account.address}&domain=${DOMAIN}`)
    ).json()
  ).nonce
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
  const res = await fetch(`${BASE}/api/wallet-auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prepared, signature }),
  })
  if (!res.ok) throw new Error(`登录失败: ${res.status}`)
  return res.headers.get("set-cookie").split(";")[0]
}

async function dbQuery(sql, params) {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  })
  await client.connect()
  try {
    return await client.query(sql, params)
  } finally {
    await client.end()
  }
}

async function main() {
  await loadEnv()
  const cookie = await signIn()
  console.log("✓ 已登录")

  // 建单
  const res = await fetch(`${BASE}/api/waffo/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
  })
  const body = await res.json()
  console.log("✓ checkout:", res.status, JSON.stringify(body))
  const checkoutUrl = body.checkoutUrl ?? body.url
  if (!checkoutUrl) throw new Error("没拿到 checkoutUrl")

  // 把 pending 订单记下来（我们的库）
  const rows = await dbQuery(
    `SELECT id, status, amount, currency FROM waffo_orders ORDER BY created_at DESC LIMIT 3`,
    [],
  )
  console.log("库里的最近订单:")
  for (const r of rows.rows) console.log(`  - ${r.id} | ${r.status} | ${r.amount} ${r.currency}`)

  console.log("\n请在浏览器完成这笔沙箱支付：")
  console.log(checkoutUrl)
  console.log("\n（测试卡 4576 7500 0000 0110 / 任意有效期 / 任意 CVC）")
  console.log("付完后运行: node scripts/waffo-e2e.mjs verify")
}

async function verify() {
  await loadEnv()
  const rows = await dbQuery(
    `SELECT id, subject, status, waffo_order_id, amount, currency, paid_at, updated_at
       FROM waffo_orders ORDER BY created_at DESC LIMIT 6`,
    [],
  )
  console.log("=== 我们库里的订单 ===")
  for (const r of rows.rows) {
    console.log(
      `  - ${r.id} | ${r.status} | subject=${r.subject ?? "-"} | waffo=${r.waffo_order_id ?? "-"} | ${r.amount} ${r.currency} | paid_at=${r.paid_at ? r.paid_at.toISOString() : "-"}`,
    )
  }
  const grants = await dbQuery(
    `SELECT id, subject, source_order_id, status, token_budget_usd, token_used_usd, expires_at
       FROM agent_service_grants ORDER BY updated_at DESC LIMIT 6`,
    [],
  )
  console.log("=== 授权发放 ===")
  for (const g of grants.rows) {
    console.log(
      `  - ${g.id} | subject=${g.subject} | order=${g.source_order_id} | ${g.status} | 预算 $${g.token_budget_usd} | 已用 $${g.token_used_usd} | 到期 ${g.expires_at ? g.expires_at.toISOString() : "-"}`,
    )
  }
  const events = await dbQuery(
    `SELECT event_id, event_type, order_id, received_at
       FROM waffo_webhook_events ORDER BY received_at DESC LIMIT 6`,
    [],
  )
  console.log("=== 收到的 webhook 事件（幂等记录）===")
  for (const e of events.rows) {
    console.log(`  - ${e.event_type} | event=${e.event_id} | order=${e.order_id ?? "-"} | ${e.received_at.toISOString()}`)
  }
}

const cmd = process.argv[2]
if (cmd === "verify") await verify()
else await main()
