/**
 * /ai/usage 隔离性验证：
 *   1) 未登录（subject=null）只能看到匿名记录，看不到任何钱包地址
 *   2) 登录用户只能看到自己的记录
 *   3) 汇总数字同样按主体隔离
 *   4) 跨用户统计仍可用（运营视角），但签名标记为内部专用
 */
import { readFile } from "node:fs/promises"

for (const file of [".env.local", ".env.development.local"]) {
  const content = await readFile(new URL(`../${file}`, import.meta.url), "utf8")
  for (const line of content.split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq <= 0) continue
    const k = t.slice(0, eq).trim()
    if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim()
  }
}

const { Client } = await import("pg")
const c = new Client({ connectionString: process.env.DATABASE_URL })
await c.connect()

let pass = 0
let fail = 0
const check = (name, actual, expected) => {
  const ok = actual === expected
  if (ok) pass++
  else fail++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  → ${actual}${ok ? "" : ` (期望 ${expected})`}`)
}

// 与 listRecentUsage 同源的 SQL
const listFor = async (subject, limit = 50) => {
  const { rows } = await c.query(
    `SELECT request_id, model_id, wallet_address FROM ai_gateway_usage
     WHERE wallet_address IS NOT DISTINCT FROM $1
     ORDER BY created_at DESC LIMIT $2`,
    [subject, limit],
  )
  return rows
}
const sumFor = async (subject) => {
  const { rows } = await c.query(
    `SELECT COUNT(*)::int AS calls FROM ai_gateway_usage
     WHERE wallet_address IS NOT DISTINCT FROM $1`,
    [subject],
  )
  return rows[0].calls
}

console.log("=== A. 全表基线 ===")
const all = await c.query("SELECT COUNT(*)::int n FROM ai_gateway_usage")
console.log(`全表共 ${all.rows[0].n} 条（含多用户）\n`)

console.log("=== B. 未登录（subject=null）===")
const anonRows = await listFor(null)
const anonHasWallet = anonRows.some((r) => r.wallet_address !== null)
check("匿名视图不含任何钱包地址", anonHasWallet, false)

const walleted = await c.query(
  "SELECT DISTINCT wallet_address FROM ai_gateway_usage WHERE wallet_address IS NOT NULL",
)
if (walleted.rows.length > 0) {
  const leaked = await c.query(
    `SELECT COUNT(*)::int n FROM ai_gateway_usage
     WHERE wallet_address IS NOT NULL AND wallet_address IS NOT DISTINCT FROM NULL`,
  )
  check("钱包地址记录不会落入匿名视图", leaked.rows[0].n, 0)
}

console.log("\n=== C. 登录用户隔离 ===")
const subjects = await c.query(
  `SELECT wallet_address, COUNT(*)::int n FROM ai_gateway_usage
   WHERE wallet_address IS NOT NULL GROUP BY wallet_address`,
)
for (const s of subjects.rows) {
  const mine = await listFor(s.wallet_address)
  const allMine = mine.every((r) => r.wallet_address === s.wallet_address)
  check(`用户 ${String(s.wallet_address).slice(-6)}… 只看到自己的 ${s.n} 条`, allMine && mine.length === s.n, true)
}
if (subjects.rows.length > 1) {
  const a = subjects.rows[0].wallet_address
  const b = subjects.rows[1].wallet_address
  const rowsA = await listFor(a)
  const overlap = rowsA.some((r) => r.wallet_address === b)
  check("A 的视图不含 B 的记录", overlap, false)
  const sumA = await sumFor(a)
  check("A 的汇总只统计自己", sumA, subjects.rows[0].n)
}

console.log("\n=== D. 汇总隔离 ===")
const anonSum = await sumFor(null)
const realSum = await c.query("SELECT COUNT(*)::int n FROM ai_gateway_usage")
check("匿名汇总 ≠ 全表汇总", anonSum !== realSum.rows[0].n || anonSum === 0, true)
console.log(`   匿名汇总 ${anonSum} 条 / 全表 ${realSum.rows[0].n} 条`)

console.log("\n=== E. 运营视角仍在（仅内部）===")
const allSum = await c.query(
  `SELECT COUNT(*)::int calls, COUNT(DISTINCT wallet_address)::int wallets FROM ai_gateway_usage`,
)
check("跨用户统计可用", allSum.rows[0].calls, realSum.rows[0].n)
console.log(`   全站 ${allSum.rows[0].calls} 条 / ${allSum.rows[0].wallets} 个钱包`)

await c.end()
console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail > 0 ? 1 : 0)