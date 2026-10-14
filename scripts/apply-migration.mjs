/**
 * 执行单个迁移 SQL 文件到 Neon Postgres。
 *
 * 用法：node scripts/apply-migration.mjs db/migrations/003_ai_gateway_usage.sql
 * 读取环境变量 DATABASE_URL（.env.local 已配置）。
 */

import { readFile, access } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

// 本地开发：手动加载 .env.local（Next.js 运行时才自动注入）
async function loadEnv() {
  for (const file of [".env.local", ".env.development.local"]) {
    try {
      const path = resolve(ROOT, file)
      await access(path)
      const { readFile: read } = await import("node:fs/promises")
      const content = await read(path, "utf8")
      for (const line of content.split("\n")) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith("#")) continue
        const eq = trimmed.indexOf("=")
        if (eq <= 0) continue
        const key = trimmed.slice(0, eq).trim()
        if (process.env[key]) continue
        process.env[key] = trimmed.slice(eq + 1).trim()
      }
    } catch {
      // 文件不存在则跳过
    }
  }
}

async function main() {
  const target = process.argv[2]
  if (!target) {
    console.error("用法: node scripts/apply-migration.mjs <sql 文件路径>")
    process.exit(1)
  }

  await loadEnv()
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error("未找到 DATABASE_URL")
    process.exit(1)
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
  console.error("迁移失败:", error)
  process.exit(1)
})
