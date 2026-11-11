/**
 * 把本地 env 文件同步到 Vercel 云端（development / preview / production）。
 *
 *   node scripts/sync-vercel-env.mjs            # 三个环境全同步
 *   node scripts/sync-vercel-env.mjs preview    # 只同步指定环境
 *
 * 规则：
 *  - 源文件：.env.development.local（dev+preview）/ .env.production.local（production）
 *  - **空值一律跳过**：本地没填的不会把云端覆盖成空，
 *    避免把线上已经配好的东西抹掉。
 *  - 已存在的条目用 PATCH 改值（body 只带 value），没有的用 POST 新建。
 *  - 已停用的 AI_GATEWAY_API_KEY 会被删除（代码已不再读取）。
 *
 * 鉴权用 Vercel CLI 的本地 token（%APPDATA%/com.vercel.cli/Data/auth.json）。
 */
import fs from "node:fs"
import { resolve } from "node:path"

const PROJECT_ID = "prj_m9E5DH8S20DrzD0evJheec3P4EJl"
const TEAM_ID = "team_hIqp1q3klTFP96UWJsAtEjac"
const API = "https://api.vercel.com"

const TARGETS = {
  development: { file: ".env.development.local", targets: ["development"] },
  preview: { file: ".env.development.local", targets: ["preview"] },
  production: { file: ".env.production.local", targets: ["production"] },
}

/** 空值跳过；其余一律同步 */
const SECRET_HINTS = ["KEY", "SECRET", "TOKEN", "PRIVATE", "PASSWORD", "SIGNING"]

/**
 * 纯本地开关：绝不同步到 Vercel。
 * COOLHA_EVE_LOCAL=1 会让云端把 /eve/v1/* rewrite 到 127.0.0.1:4274 —— 云上没有这个进程。
 */
const LOCAL_ONLY = new Set(["COOLHA_EVE_LOCAL"])

/** Waffo 已退出。同步脚本不得把这些变量推回去。 */
function isRetired(key) {
  return key.startsWith("WAFFO_") || key === "AI_GATEWAY_API_KEY"
}

function parseEnv(path) {
  const map = new Map()
  if (!fs.existsSync(path)) return map
  for (const line of fs.readFileSync(path, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq <= 0) continue
    const key = t.slice(0, eq).trim()
    let value = t.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (!value) continue // 空值不推
    map.set(key, value)
  }
  return map
}

function authToken() {
  const candidates = [
    process.env.VERCEL_TOKEN,
    process.env.APPDATA && resolve(process.env.APPDATA, "com.vercel.cli/Data/auth.json"),
    resolve(process.env.HOME ?? "", ".local/share/com.vercel.cli/auth.json"),
  ].filter(Boolean)
  for (const file of candidates) {
    try {
      const raw = fs.readFileSync(file, "utf8")
      const token = JSON.parse(raw).token
      if (token) return token
    } catch {
      // 试下一个
    }
  }
  throw new Error("找不到 Vercel token：先跑 npx vercel login，或设 VERCEL_TOKEN")
}

async function api(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${text.slice(0, 200)}`)
  }
  return text ? JSON.parse(text) : {}
}

async function main() {
  const only = process.argv[2]
  const token = authToken()
  const current = await api(token, `/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`)

  let created = 0
  let updated = 0
  let skipped = 0

  for (const [envName, cfg] of Object.entries(TARGETS)) {
    if (only && only !== envName) continue
    const values = parseEnv(resolve(process.cwd(), cfg.file))
    console.log(`\n[${envName}] 源文件 ${cfg.file} · ${values.size} 个非空变量`)

    for (const [key, value] of values) {
      if (LOCAL_ONLY.has(key)) {
        console.log(`  · 跳过 ${key}（纯本地开关，不上云）`)
        continue
      }
      if (key.startsWith("WAFFO_")) {
        console.log(`  · 跳过 ${key}（Waffo 已退出，不再推送）`)
        continue
      }
      const isSecret = SECRET_HINTS.some((h) => key.includes(h))
      const type = isSecret ? "encrypted" : "plain"

      // 已有条目：优先复用「目标完全覆盖」的那条；否则复用「目标有交集」的那条
      // （Vercel 不允许同名同环境并存，所以只能改已有条目，不能新建）
      const sameKey = (current.envs ?? []).filter((e) => e.key === key)
      const exact = sameKey.find((e) => sameTargets(e.target ?? [], cfg.targets))
      const covering = sameKey.find((e) => coversTargets(e.target ?? [], cfg.targets))
      const overlapping = sameKey.find((e) =>
        (e.target ?? []).some((t) => cfg.targets.includes(t)),
      )
      const entry = exact ?? covering ?? overlapping

      if (entry) {
        await api(token, `/v9/projects/${PROJECT_ID}/env/${entry.id}?teamId=${TEAM_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ value }),
        })
        updated += 1
        const scope = (entry.target ?? []).join(",")
        console.log(`  ↻ 更新 ${key} [${scope}]`)
        continue
      }

      // 没有可复用条目 → 新建
      await api(token, `/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
        method: "POST",
        body: JSON.stringify({
          key,
          value,
          type,
          target: cfg.targets,
        }),
      })
      created += 1
      console.log(`  + 新建 ${key} (${cfg.targets.join(",")}${isSecret ? ", secret" : ""})`)
    }

    // 清理已停用 / 纯本地的变量
    for (const entry of current.envs ?? []) {
      const dead = isRetired(entry.key)
      const localOnly = LOCAL_ONLY.has(entry.key)
      if (!dead && !localOnly) continue
      if (!(entry.target ?? []).some((t) => cfg.targets.includes(t))) continue
      try {
        await api(token, `/v9/projects/${PROJECT_ID}/env/${entry.id}?teamId=${TEAM_ID}`, {
          method: "DELETE",
        })
        console.log(
          `  − 删除 ${entry.key}（${dead ? "代码已不再读取" : "纯本地开关，不该上云"}）`,
        )
        skipped += 1
      } catch (error) {
        // 已删过（404）：不算失败
        if (!String(error.message).includes("404")) throw error
      }
    }
  }

  console.log(`\n完成：新建 ${created} · 更新 ${updated} · 删除 ${skipped}`)
  console.log("提示：改完 env 需要 Redeploy 才会生效。")
}

function sameTargets(a, b) {
  const x = [...new Set(a)].sort()
  const y = [...new Set(b)].sort()
  return x.length === y.length && x.every((v, i) => v === y[i])
}

/** a 是否覆盖 b（b 的每个目标都在 a 里） */
function coversTargets(a, b) {
  const set = new Set(a)
  return b.every((t) => set.has(t))
}

main().catch((error) => {
  console.error("同步失败:", error.message)
  process.exit(1)
})
