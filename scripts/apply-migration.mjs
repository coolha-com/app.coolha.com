/**
 * 执行单个迁移 SQL 文件到 Neon Postgres。
 *
 * 用法：
 *   node scripts/apply-migration.mjs db/migrations/012_identity_web2.sql          # 默认打 dev 分支
 *   node scripts/apply-migration.mjs db/migrations/012_identity_web2.sql --prod   # 显式打生产分支
 *
 * 环境文件优先级与 Next.js 一致（后者覆盖前者）：
 *   dev（默认）  .env.local → .env.development.local
 *   --prod      .env.local → .env.production.local
 *
 * 之前是「.env.local 先加载且已存在就跳过」，而四个文件的 DATABASE_URL 又曾完全一致，
 * 结果本地以为在改 dev、实际改的是生产库。现在打印目标 endpoint，并且生产 endpoint 会显式告警。
 */

import { readFile, access } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** 本项目已知的生产分支 endpoint；命中时必须显式提示 */
const PRODUCTION_ENDPOINT = "ep-tiny-wildflower-a1kcciel"

const isProd = process.argv.includes("--prod")
const ENV_FILES = isProd
  ? [".env.local", ".env.production.local"]
  : [".env.local", ".env.development.local"]

/**
 * 手动加载 env 文件。后加载的文件覆盖先加载的（与 Next.js 的 .env.*.local 优先级一致），
 * 否则本地 dev 的 DATABASE_URL 会被基线文件静默盖掉。
 */
async function loadEnv() {
  for (const file of ENV_FILES) {
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
        // vercel env pull 的输出会给值加引号；必须剥掉，
        // 否则 DATABASE_URL 带上引号，pg 解析出的 host 会变成错误值。
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
  const target = process.argv[2]
  if (!target || target.startsWith("--")) {
    console.error("用法: node scripts/apply-migration.mjs <sql 文件路径> [--prod]")
    process.exit(1)
  }

  await loadEnv()
  // 迁移与 DDL 走直连（PgBouncer 事务模式下会话级操作不可靠），与 .env.local.example 的约定一致
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  if (!connectionString) {
    console.error("未找到 DATABASE_URL_UNPOOLED / DATABASE_URL")
    process.exit(1)
  }

  let host = ""
  try {
    host = new URL(connectionString).hostname
  } catch {
    host = "(无法解析)"
  }

  console.log(`环境文件: ${ENV_FILES.join(" → ")}（后者覆盖前者）`)
  console.log(`目标数据库: ${host}`)
  if (host.includes(PRODUCTION_ENDPOINT)) {
    console.log("⚠️  注意：这是 **生产分支（main）**，改动会直接影响线上数据。")
  } else {
    console.log("✓ 非生产分支")
  }

  const sql = await readFile(resolve(process.cwd(), target), "utf8")
  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    await client.query(sql)
    console.log(`✓ 已执行迁移: ${target}`)
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error("迁移失败:", error.message ?? error)
  process.exit(1)
})
