// 会话留档端到端验证：钱包登录 → 创建会话 → 写入 eve 游标/事件 → 列表 → 单条读取 → 清理
//
// 用 Hardhat/Anvil 公开测试账户 #0（无真实资产），跑完自动清理测试行。
//   node scripts/sessions-smoke.mjs
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
  const checks = []
  const record = (name, ok, detail = "") => {
    checks.push({ name, ok, detail })
    console.log(`${ok ? "PASS" : "FAIL"} - ${name}${detail ? ` (${detail})` : ""}`)
  }

  // 0. 匿名访问必须被拒
  const anon = await fetch(`${BASE}/api/agents/sessions`)
  record("匿名读列表返回 401", anon.status === 401, `status=${anon.status}`)

  // 1. 钱包登录
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

  const auth = { headers: { cookie } }

  // 2. 创建会话
  const sessionId = `smoke_${Date.now()}`
  const createRes = await fetch(`${BASE}/api/agents/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      id: sessionId,
      agentId: "coolha-rwa",
      title: "冒烟任务",
      config: {
        model: "deepseek/deepseek-v4.1-flash-1017",
        constraints: { readOnly: true, citeSources: true, unverifiedNotFact: true },
      },
    }),
  })
  const createJson = await createRes.json()
  record(
    "创建会话返回 id",
    createRes.status === 200 && createJson.id === sessionId,
    `status=${createRes.status} id=${createJson.id}`,
  )

  // 3. 写入 eve 会话游标与事件流
  const putRes = await fetch(`${BASE}/api/agents/sessions/${sessionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      eveSession: { cursor: "smoke-cursor" },
      eveEvents: [{ type: "text", text: "冒烟消息" }],
      transcript: [
        { id: "m1", role: "user", parts: [{ type: "text", text: "冒烟提问" }] },
        { id: "m2", role: "assistant", parts: [{ type: "text", text: "冒烟回答" }] },
      ],
      preview: "冒烟消息预览",
      title: "冒烟任务标题",
    }),
  })
  record("写入会话内容成功", putRes.status === 200, `status=${putRes.status}`)

  // 4. 列表能读到
  const listRes = await fetch(`${BASE}/api/agents/sessions`, auth)
  const listJson = await listRes.json()
  const listed = (listJson.sessions ?? []).find((s) => s.id === sessionId)
  record("历史任务列表包含该会话", listRes.status === 200 && Boolean(listed), `status=${listRes.status}`)
  record(
    "列表展示标题与预览",
    listed?.title === "冒烟任务标题" && listed?.preview === "冒烟消息预览",
    `title=${listed?.title} preview=${listed?.preview}`,
  )

  // 5. 单条能读回 eve 数据
  const getRes = await fetch(`${BASE}/api/agents/sessions/${sessionId}`, auth)
  const getJson = await getRes.json()
  const s = getJson.session
  record(
    "读回 eve 游标与事件流",
    getRes.status === 200 &&
      s?.eveSession?.cursor === "smoke-cursor" &&
      Array.isArray(s?.eveEvents) &&
      s.eveEvents[0]?.text === "冒烟消息",
    `status=${getRes.status}`,
  )
  record(
    "读回配置快照",
    s?.config?.model === "deepseek/deepseek-v4.1-flash-1017" &&
      s?.config?.constraints?.readOnly === true,
  )
  record(
    "读回 transcript（与 eve 版本无关的对话记录）",
    Array.isArray(s?.transcript) &&
      s.transcript.length === 2 &&
      s.transcript[0].role === "user" &&
      s.transcript[1].parts[0].text === "冒烟回答",
    `transcript=${JSON.stringify(s?.transcript)?.slice(0, 60)}`,
  )

  // 6. 不存在的会话 → 404
  const missing = await fetch(`${BASE}/api/agents/sessions/does_not_exist_${Date.now()}`, auth)
  record("不存在的会话返回 404", missing.status === 404, `status=${missing.status}`)

  // 7. 清理
  await loadEnv()
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  if (connectionString) {
    const client = new pg.Client({ connectionString })
    await client.connect()
    await client.query("DELETE FROM chat_sessions WHERE id = $1", [sessionId])
    await client.end()
    const after = await fetch(`${BASE}/api/agents/sessions/${sessionId}`, auth)
    record("清理后不再可读", after.status === 404, `status=${after.status}`)
  }

  const pass = checks.every((c) => c.ok)
  console.log(pass ? "SESSIONS_RESULT: ALL_PASS" : "SESSIONS_RESULT: FAIL")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error("SESSIONS_ERROR:", e.message)
  process.exit(1)
})
