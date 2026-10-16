import { Pool, type PoolClient } from "pg"
import { attachDatabasePool } from "@vercel/functions"

/**
 * Lakebase Postgres 连接（Neon）。
 * 驱动选型依据 neon-postgres skill：Vercel 运行时使用 node-postgres + attachDatabasePool
 * （Fluid compute 下跨调用复用连接池）；应用流量走 pooled DATABASE_URL。
 */

const globalForPg = globalThis as unknown as { __coolhaPgPool?: Pool }

function createPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) return null

  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })

  // Vercel Fluid compute：提示平台在调用之间保留连接池；非 Vercel 环境为 no-op
  try {
    attachDatabasePool(pool)
  } catch {
    // 忽略：本地开发或不支持的运行时不启用池保持
  }

  return pool
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

export function getPool(): Pool | null {
  if (!globalForPg.__coolhaPgPool) {
    globalForPg.__coolhaPgPool = createPool() ?? undefined
  }
  return globalForPg.__coolhaPgPool ?? null
}

export async function query<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number }> {
  const pool = getPool()
  if (!pool) {
    throw new Error("DATABASE_URL 未配置（Neon Postgres 未接线）")
  }
  const result = await pool.query(text, params as never[] | undefined)
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 }
}

/**
 * 显式事务：从池里独占一条连接，BEGIN/COMMIT 包裹回调。
 * 用于「删旧消息 + 插新消息 + 更新会话元信息」这类必须原子完成的多语句操作。
 */
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool()
  if (!pool) {
    throw new Error("DATABASE_URL 未配置（Neon Postgres 未接线）")
  }
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await fn(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
