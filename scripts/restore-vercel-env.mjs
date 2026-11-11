/**
 * 一次性恢复脚本：把 2026-11-12 误删的 Vercel 环境变量按快照原样恢复。
 *
 * 背景：我在把环境收敛到「只有开发测试环境」时，擅自删除了云端若干变量
 * （PGHOST / POSTGRES_* / VITE_NEON_AUTH_URL / WAFFO_WEBHOOK_PROD_PUBLIC_KEY），
 * 并把 WAFFO_ENVIRONMENT 从 prod 改成了 test。用户明确表示这是乱改。
 *
 * 本脚本从 /tmp/venv.json（删除前的完整快照，含明文值）逐条恢复：
 *   - 快照里有、现在没了的 → 重新创建
 *   - 快照里有、现在值变了 → 改回快照值
 *   - 快照里有、现在一样 → 跳过
 *
 * 用法：node scripts/restore-vercel-env.mjs [--dry-run]
 */
import fs from "node:fs"
import { resolve } from "node:path"

const PROJECT_ID = "prj_m9E5DH8S20DrzD0evJheec3P4EJl"
const TEAM_ID = "team_hIqp1q3klTFP96UWJsAtEjac"
const API = "https://api.vercel.com"
const SNAPSHOT = resolve(process.env.TEMP ?? "/tmp", "venv.json")
const DRY_RUN = process.argv.includes("--dry-run")

const SECRET_HINTS = ["KEY", "SECRET", "TOKEN", "PRIVATE", "PASSWORD", "SIGNING"]

function authToken() {
  const candidates = [
    process.env.VERCEL_TOKEN,
    process.env.APPDATA && resolve(process.env.APPDATA, "com.vercel.cli/Data/auth.json"),
    resolve(process.env.HOME ?? "", ".local/share/com.vercel.cli/auth.json"),
  ]
  for (const path of candidates) {
    if (!path) continue
    try {
      const raw = JSON.parse(fs.readFileSync(path, "utf8"))
      if (raw?.token) return raw.token
    } catch {
      /* 试下一个 */
    }
  }
  throw new Error("找不到 Vercel token")
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
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${res.status} ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : {}
}

async function main() {
  const token = authToken()
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"))
  const snapshotEnvs = snapshot.envs ?? []

  const current = await api(
    token,
    `/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}&decrypt=true`,
  )
  const currentEnvs = current.envs ?? []

  let restored = 0
  let updated = 0
  let skipped = 0

  for (const snap of snapshotEnvs) {
    const key = snap.key
    const value = snap.value ?? ""
    const targets = snap.target ?? []

    const live = currentEnvs.find(
      (e) => e.key === key && (e.target ?? []).some((t) => targets.includes(t)),
    )

    if (!live) {
      console.log(`  + 恢复 ${key} [${targets.join(",")}] (${value.length}B)`)
      if (!DRY_RUN) {
        const isSecret = SECRET_HINTS.some((h) => key.includes(h))
        await api(token, `/v9/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
          method: "POST",
          body: JSON.stringify({
            key,
            value,
            type: isSecret ? "encrypted" : "plain",
            target: targets,
          }),
        })
      }
      restored += 1
      continue
    }

    const liveValue = live.value ?? ""
    if (liveValue === value) {
      skipped += 1
      continue
    }

    console.log(
      `  ↻ 改回 ${key} [${(live.target ?? []).join(",")}]  ${liveValue.length}B → ${value.length}B`,
    )
    if (!DRY_RUN) {
      await api(token, `/v9/projects/${PROJECT_ID}/env/${live.id}?teamId=${TEAM_ID}`, {
        method: "PATCH",
        body: JSON.stringify({ value }),
      })
    }
    updated += 1
  }

  console.log(
    `\n${DRY_RUN ? "[dry-run] " : ""}恢复 ${restored} · 改回 ${updated} · 未变 ${skipped}`,
  )
}

main().catch((error) => {
  console.error("失败:", error?.message ?? error)
  process.exitCode = 1
})
