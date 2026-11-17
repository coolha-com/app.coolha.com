// Creem 测试通道端到端冒烟：钱包登录 → 建 checkout → 落库 → 查单 → 清理
//
// 用 Hardhat/Anvil 公开测试账户 #0（无真实资产），Creem 侧用沙箱（creem_test_）。
// 只创建 checkout 会话（不付款），跑完删除测试订单行，不留脏数据。
//   node scripts/creem-smoke.mjs
import { SiweMessage } from "siwe"
import { privateKeyToAccount } from "viem/accounts"
import pg from "pg"
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
        process.env[key] = value
      }
    } catch {
      // 文件不存在跳过
    }
  }
}

async function main() {
  await loadEnv()
  const checks = []
  const record = (name, ok, detail = "") => {
    checks.push({ name, ok })
    console.log(`${ok ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`)
  }

  // 0. 匿名建单必须被拒
  const anon = await fetch(`${BASE}/api/creem/checkout`, { method: "POST" })
  record("匿名建单返回 401", anon.status === 401, `status=${anon.status}`)

  // 1. 钱包登录
  const nonceRes = await fetch(`${BASE}/api/wallet-auth/nonce?address=${account.address}&domain=${DOMAIN}`)
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
  if (!cookie) throw new Error("登录失败，终止")

  // 2. 建 Creem checkout（真实打沙箱，带 origin 让 success_url 是绝对地址）
  const createRes = await fetch(`${BASE}/api/creem/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie, origin: BASE },
  })
  const createJson = await createRes.json()
  const orderId = createJson.orderId
  record(
    "建 checkout 成功",
    createRes.status === 200 && Boolean(createJson.checkoutUrl) && String(orderId).startsWith("creem_"),
    `status=${createRes.status} code=${createJson.error?.code ?? ""}`,
  )
  if (!orderId) throw new Error(`建单失败: ${JSON.stringify(createJson)}`)

  // 3. 落库校验：订单状态 pending，subject 与 checkout_id 有值
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  let subject = null
  try {
    const { rows } = await pool.query(
      `SELECT id, subject, status, checkout_id, product_id FROM creem_orders WHERE id = $1`,
      [orderId],
    )
    const row = rows[0]
    subject = row?.subject ?? null
    record(
      "订单落库且状态为 pending",
      Boolean(row) && row.status === "pending" && Boolean(row.checkout_id) && Boolean(subject),
      row ? `status=${row.status} checkout=${row.checkout_id} subject=${String(subject).slice(0, 12)}` : "no row",
    )
  } finally {
    await pool.end()
  }

  // 4. 查单接口能看到刚建的订单
  const listRes = await fetch(`${BASE}/api/creem/checkout`, { headers: { cookie } })
  const listJson = await listRes.json()
  const listed = (listJson.orders ?? []).find((o) => o.id === orderId)
  record("查单接口返回该订单", listRes.status === 200 && Boolean(listed), `status=${listRes.status}`)

  // 5. 清理测试订单（只删这一行）
  try {
    const pool2 = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    try {
      await pool2.query(`DELETE FROM creem_webhook_events WHERE order_id = $1`, [orderId])
      const { rowCount } = await pool2.query(`DELETE FROM creem_orders WHERE id = $1`, [orderId])
      record("清理测试订单", rowCount === 1, `deleted=${rowCount}`)
    } finally {
      await pool2.end()
    }
  } catch (error) {
    record("清理测试订单", false, error.message)
  }

  const failed = checks.filter((c) => !c.ok)
  console.log(`\n结果：${checks.length - failed.length}/${checks.length} 通过`)
  process.exit(failed.length === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error("冒烟脚本异常:", error)
  process.exit(1)
})
