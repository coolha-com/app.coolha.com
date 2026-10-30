/**
 * 新库结构自检：确认 db/migrations/001~009 是否已全部生效。
 *
 * 用法：
 *   node scripts/check-db-schema.mjs                # 读 .env.local
 *   DATABASE_URL="postgresql://..." node scripts/check-db-schema.mjs
 *
 * 输出：当前连的库（只显示 host）、已存在表、缺失表、建议执行的迁移文件。
 * 安全：绝不打印完整连接串或密码。
 */
import { readFile } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** 迁移应创建的全部表（按迁移文件归属分组，便于定位缺口） */
const MIGRATION_TABLES = [
  { file: "001_wallet_auth.sql", tables: ["wallet_users", "wallet_sessions", "wallet_nonces"] },
  { file: "003_ai_gateway_usage.sql", tables: ["ai_gateway_usage"] },
  { file: "004_model_catalog.sql", tables: ["model_catalog"] },
  { file: "005_entitlements_and_quota.sql", tables: ["entitlements", "usage_daily", "compute_ledger"] },
  { file: "006_identity_users.sql", tables: ["users", "user_identities", "billing_addresses"] },
  { file: "007_subscription_orders.sql", tables: ["subscription_orders"] },
  { file: "008_chat_history.sql", tables: ["chat_threads", "chat_messages"] },
  { file: "009_catalog_sync_backoff.sql", tables: ["model_catalog_sync"] },
]

const ALL_TABLES = MIGRATION_TABLES.flatMap((m) => m.tables)

async function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    const raw = await readFile(resolve(ROOT, ".env.local"), "utf8")
    const m = raw.match(/^DATABASE_URL=(.*)$/m)
    return m ? m[1].trim().replace(/^['"]|['"]$/g, "") : null
  } catch {
    return null
  }
}

/** 只暴露 host，绝不输出凭据 */
function hostOf(url) {
  try {
    return new URL(url).host
  } catch {
    return "(无法解析)"
  }
}

const url = await loadDatabaseUrl()
if (!url) {
  console.error("❌ 未找到 DATABASE_URL（请在 .env.local 或环境变量中提供）")
  process.exit(1)
}

console.log(`连接目标 host: ${hostOf(url)}`)
console.log("")

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000 })

try {
  await client.connect()
} catch (error) {
  console.error("❌ 连接失败:", error.code ?? "(无错误码)", "|", (error.message ?? "").split("\n")[0].slice(0, 90))
  console.error("   若为 28P01，说明该库已被删除或凭证失效，需要先同步新的 DATABASE_URL。")
  process.exit(1)
}

try {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`,
  )
  const existing = new Set(rows.map((r) => r.table_name))

  console.log(`已存在的表 (${existing.size}):`)
  console.log(existing.size > 0 ? `  ${[...existing].join(", ")}` : "  （空库）")
  console.log("")

  const missing = ALL_TABLES.filter((t) => !existing.has(t))
  if (missing.length === 0) {
    console.log("✅ 结构完整：001~009 涉及的 15 张表全部存在。")
  } else {
    console.log(`⚠️ 缺失 ${missing.length} 张表：${missing.join(", ")}`)
    console.log("")
    console.log("需要执行的迁移：")
    for (const m of MIGRATION_TABLES) {
      const lack = m.tables.filter((t) => !existing.has(t))
      if (lack.length > 0) {
        console.log(`  node scripts/apply-migration.mjs db/migrations/${m.file}    # 缺 ${lack.join(", ")}`)
      }
    }
  }
} finally {
  await client.end()
}
