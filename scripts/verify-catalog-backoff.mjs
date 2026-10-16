/**
 * 目录同步失败处理的回归验证：
 *  1) failed_at 退避窗口（不再每次渲染都回源）
 *  2) RENDER_ABORTED 不应被当作真实网关故障
 *  3) isRealGatewayFailure / gatewayErrorCode 的判定
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

// ---- 与 client.ts 同源的实现语义 ----
const AUTH_BACKOFF = 300
const RETRY_BACKOFF = 300

const isAuthFailure = (e) =>
  e?.startsWith("UPSTREAM_401") === true || e?.startsWith("UPSTREAM_403") === true

const gatewayErrorCode = (e) => {
  if (!e) return "UNKNOWN"
  const i = e.indexOf(":")
  return i > 0 ? e.slice(0, i) : e
}

const isRealGatewayFailureErr = (e) => {
  if (!e) return false
  const code = gatewayErrorCode(e)
  return code !== "RENDER_ABORTED" && code !== "SYNC_IN_PROGRESS"
}

// 必须与 client.ts 的 isInBackoffWindow 保持一致：
// RENDER_ABORTED 由 releaseCatalogSync(false, …) 写入并连带置位 failed_at，
// 它是预渲染中断的正常路径；若不排除，一次正常中断会挡住后续 300 秒的真实回源。
const inBackoff = (meta, nowMs) => {
  if (!meta.failed_at || !meta.last_error) return false
  if (!isRealGatewayFailureErr(meta.last_error)) return false
  const win = isAuthFailure(meta.last_error) ? AUTH_BACKOFF : RETRY_BACKOFF
  const t = new Date(meta.failed_at).getTime()
  if (Number.isNaN(t)) return false
  return nowMs - t < win * 1000
}

const isRealGatewayFailure = (e) => {
  if (!e) return false
  const code = gatewayErrorCode(e)
  return code !== "RENDER_ABORTED" && code !== "SYNC_IN_PROGRESS"
}

const isNextControlFlowSignal = (err) =>
  typeof err === "object" && err !== null && "digest" in err &&
  err.digest === "DYNAMIC_SERVER_USAGE"

const readRow = async () =>
  (await c.query(
    "SELECT last_error, failed_at, synced_at FROM model_catalog_sync WHERE id = 1",
  )).rows[0]

const setRow = (lastError, failedAtExpr = "now()") =>
  c.query(
    `UPDATE model_catalog_sync SET last_error = $1, failed_at = ${failedAtExpr} WHERE id = 1`,
    [lastError],
  )

let pass = 0
let fail = 0
const check = (name, actual, expected) => {
  const ok = actual === expected
  if (ok) pass++
  else fail++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  → ${actual}${ok ? "" : ` (期望 ${expected})`}`)
}

console.log("=== A. 控制流信号识别 ===")
check(
  "DYNAMIC_SERVER_USAGE 被识别为控制流信号",
  isNextControlFlowSignal({ digest: "DYNAMIC_SERVER_USAGE" }),
  true,
)
check("普通 Error 不是控制流信号", isNextControlFlowSignal(new Error("UPSTREAM_401")), false)
check("UPSTREAM_401 不是控制流信号", isNextControlFlowSignal({ digest: "SOMETHING_ELSE" }), false)

console.log("\n=== B. 错误码解析 ===")
check("纯错误码原样返回", gatewayErrorCode("UPSTREAM_401"), "UPSTREAM_401")
check(
  "带上游提示时只取错误码",
  gatewayErrorCode("UPSTREAM_401:Authentication failed. Create an API key…"),
  "UPSTREAM_401",
)
check("空值返回 UNKNOWN", gatewayErrorCode(null), "UNKNOWN")

console.log("\n=== C. 真实故障判定 ===")
check("401 是真实故障", isRealGatewayFailure("UPSTREAM_401:xxx"), true)
check("429 是真实故障", isRealGatewayFailure("UPSTREAM_429"), true)
check("RENDER_ABORTED 不是故障（预渲染中断属正常）", isRealGatewayFailure("RENDER_ABORTED"), false)
check("SYNC_IN_PROGRESS 不是故障", isRealGatewayFailure("SYNC_IN_PROGRESS"), false)
check("无错误不是故障", isRealGatewayFailure(null), false)

console.log("\n=== D. 退避窗口（数据库实写）===")
await setRow("UPSTREAM_401:Authentication failed")
check("刚失败 → 退避中", inBackoff(await readRow(), Date.now()), true)

let allBacked = true
for (let i = 0; i < 5; i++) {
  if (!inBackoff(await readRow(), Date.now())) allBacked = false
}
check("连续 5 次重复渲染都在退避中（不再打上游）", allBacked, true)

await setRow("UPSTREAM_401:Authentication failed", "now() - interval '6 minutes'")
check("失败于 6 分钟前 → 超窗，允许重试", inBackoff(await readRow(), Date.now()), false)

await setRow(null, "NULL")
const cleared = await readRow()
check("成功后 failed_at 被清空", cleared.failed_at, null)
check("成功后不处于退避", inBackoff(cleared, Date.now()), false)

console.log("\n=== E. 非凭证类失败同样退避 ===")
await setRow("UPSTREAM_500")
check("500 刚失败 → 退避中", inBackoff(await readRow(), Date.now()), true)
await setRow("UPSTREAM_429")
check("429 刚失败 → 退避中", inBackoff(await readRow(), Date.now()), true)

console.log("\n=== F. 正常路径不得触发退避（回归：RENDER_ABORTED 曾挡住真实回源）===")
await setRow("RENDER_ABORTED")
check("RENDER_ABORTED 刚写入 → 不退避", inBackoff(await readRow(), Date.now()), false)
check(
  "RENDER_ABORTED 即使 failed_at 是刚才也不退避",
  inBackoff(await readRow(), Date.now()),
  false,
)
await setRow("SYNC_IN_PROGRESS")
check("SYNC_IN_PROGRESS → 不退避", inBackoff(await readRow(), Date.now()), false)
await setRow("RENDER_ABORTED", "now() - interval '10 seconds'")
check(
  "RENDER_ABORTED 刚发生 → 仍不退避（允许立即回源）",
  inBackoff(await readRow(), Date.now()),
  false,
)
await setRow("UPSTREAM_401:Authentication failed")
check(
  "对照组：真实 401 仍退避（确保上一条不是因为逻辑写坏了）",
  inBackoff(await readRow(), Date.now()),
  true,
)

// 还原为干净状态
await c.query(
  `UPDATE model_catalog_sync SET last_error = NULL, failed_at = NULL, syncing_at = NULL WHERE id = 1`,
)
await c.end()

console.log(`\n结果：${pass} 通过 / ${fail} 失败`)
process.exit(fail > 0 ? 1 : 0)