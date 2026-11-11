/**
 * 把 Waffo 沙箱 webhook 指向指定 URL（并可选地订阅/退订事件）。
 *
 * 用法：
 *   node scripts/waffo-webhook.mjs list
 *   node scripts/waffo-webhook.mjs set-test <url>     # 改沙箱（testMode=true）条目的 URL
 *   node scripts/waffo-webhook.mjs add-test <url>     # 新增一条沙箱条目（本地隧道用，可与上面并存）
 *   node scripts/waffo-webhook.mjs add-prod <url>     # 新增正式（testMode=false）条目
 *   node scripts/waffo-webhook.mjs remove <webhookId>
 *
 * 事实（2026-11-12 实测）：
 *   - webhook 是**独立条目**，每条带自己的 testMode 标志，可以有多条指向同一 URL；
 *   - 列表只有 GraphQL 一个入口：Store.storeWebhooks；
 *   - testMode 与 channel 在 update 时**不可变**（SDK 明确说明）。
 */
import { WaffoPancake } from "@waffo/pancake-ts"
import { readFile } from "node:fs/promises"

const ALL_EVENTS = [
  "order.completed",
  "subscription.activated",
  "subscription.payment_succeeded",
  "subscription.renewed",
  "subscription.recovered",
  "subscription.plan_changed",
  "subscription.plan_change_scheduled",
  "subscription.plan_change_failed",
  "subscription.canceling",
  "subscription.uncanceled",
  "subscription.canceled",
  "subscription.past_due",
  "refund.succeeded",
  "refund.failed",
  "store.domain_changed",
]

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

function makeClient() {
  return new WaffoPancake({
    merchantId: process.env.WAFFO_MERCHANT_ID,
    privateKey: process.env.WAFFO_PRIVATE_KEY,
    environment: "test",
  })
}

async function list(client) {
  const r = await client.graphql.query({
    query: `query { store(id: "${process.env.WAFFO_STORE_ID}") {
      storeWebhooks { id channel url events testMode createdAt }
    } }`,
  })
  const ws = r.data?.store?.storeWebhooks ?? []
  console.log(`已注册 webhook 条目：${ws.length} 条`)
  for (const w of ws) {
    console.log(`  ─ id=${w.id}`)
    console.log(
      `    channel=${w.channel}  testMode=${w.testMode}  → ${
        w.testMode ? "TEST 沙箱投递" : "PROD 正式投递"
      }`,
    )
    console.log(`    url=${w.url}`)
    console.log(`    events=${(w.events ?? []).join(", ")}`)
  }
  return ws
}

async function main() {
  await loadEnv()
  const client = makeClient()
  const [cmd, arg] = process.argv.slice(2)

  if (cmd === "list" || !cmd) {
    await list(client)
    return
  }

  if (cmd === "set-test" || cmd === "set-prod") {
    const wantTest = cmd === "set-test"
    const url = arg
    if (!url) throw new Error(`用法: node scripts/waffo-webhook.mjs ${cmd} <url>`)
    const ws = await list(client)
    const hit = ws.find((w) => w.testMode === wantTest && w.channel === "http")
    if (!hit) {
      console.log(
        `没有 testMode=${wantTest} 的 http 条目 → 新建（SDK 说明 testMode 不可变，只能新建）`,
      )
      const res = await client.webhooks.add({
        storeId: process.env.WAFFO_STORE_ID,
        channel: "http",
        url,
        events: ALL_EVENTS,
        testMode: wantTest,
      })
      console.log("已新建:", res.webhook?.id, "→", res.webhook?.url)
      return
    }
    await client.webhooks.update({ id: hit.id, url, events: ALL_EVENTS })
    console.log(`已更新 ${hit.id} → ${url}`)
    await list(client)
    return
  }

  if (cmd === "add-prod" || cmd === "add-test") {
    const url = arg
    if (!url) throw new Error(`用法: node scripts/waffo-webhook.mjs ${cmd} <url>`)
    const testMode = cmd === "add-test"
    // 实测：同 store 下可以有多条 channel=http + 相同 testMode 的条目并存，
    // 各投各的 → 本地隧道条目可以与「预览部署」条目同时存在，不用来回改 URL。
    const res = await client.webhooks.add({
      storeId: process.env.WAFFO_STORE_ID,
      channel: "http",
      url,
      events: ALL_EVENTS,
      testMode,
    })
    console.log(
      `已新增 ${testMode ? "TEST" : "PROD"} 条目: ${res.webhook?.id} → ${res.webhook?.url}`,
    )
    await list(client)
    return
  }

  if (cmd === "remove") {
    const id = arg
    if (!id) throw new Error("用法: node scripts/waffo-webhook.mjs remove <webhookId>")
    await client.webhooks.remove({ id })
    console.log("已删除:", id)
    return
  }

  throw new Error(`未知命令: ${cmd}`)
}

main().catch((error) => {
  console.error("失败:", error?.message ?? error)
  process.exitCode = 1
})
