import "server-only"

import { unstable_cache } from "next/cache"
import { getPool, isDatabaseConfigured, query } from "./postgres"
import { deriveProviders } from "@/lib/compute/service"
import type { ComputeModel, ComputeProvider } from "@/lib/compute/types"
import { CATALOG_CACHE_TAG, CATALOG_REVALIDATE_SECONDS } from "@/lib/ai-gateway/shared"

/**
 * 模型目录的数据库持久层（Neon Postgres）。
 *
 * 读路径：readCatalogSnapshot —— 页面与公开 API 只查库，不回源上游。
 * 写路径：writeCatalogSnapshot + 认领锁 —— 只有成功认领的实例才允许回源，
 *         保证同一时间窗口内上游最多被调用一次（降低限额消耗）。
 */

export interface CatalogSnapshot {
  models: ComputeModel[]
  providers: ComputeProvider[]
  source: "ai-gateway" | "demo"
  /** 快照写入时间（ISO） */
  syncedAt: string
  /** 上游最近一次同步失败原因 */
  lastError?: string
  /** 上游最近一次同步失败时刻（ISO）；用于退避窗口判定 */
  failedAt?: string
}

interface SyncMetaRow {
  source: "ai-gateway" | "demo"
  model_count: number
  synced_at: Date
  syncing_at: Date | null
  last_error: string | null
  failed_at: Date | null
}

interface ModelRow {
  payload: ComputeModel
}

/** 读取当前目录快照；无数据或数据库未接线时返回 null */
export async function readCatalogSnapshot(): Promise<CatalogSnapshot | null> {
  if (!isDatabaseConfigured()) return null

  try {
    const meta = await query<SyncMetaRow>(
      `SELECT source, model_count, synced_at, syncing_at, last_error, failed_at
       FROM model_catalog_sync WHERE id = 1`,
    )
    const row = meta.rows[0]
    if (!row) return null

    const models = await query<ModelRow>(
      `SELECT payload FROM model_catalog ORDER BY id`,
    )
    if (models.rows.length === 0) return null

    const list = models.rows
      .map((item) => item.payload)
      .filter((model): model is ComputeModel => Boolean(model?.id))

    return {
      models: list,
      providers: deriveProviders(list),
      source: row.source,
      syncedAt: row.synced_at.toISOString(),
      lastError: row.last_error ?? undefined,
      failedAt: row.failed_at ? row.failed_at.toISOString() : undefined,
    }
  } catch (error) {
    console.error("[model-catalog] 读取目录快照失败:", error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * 写入目录快照（单事务 + 单次批量写入）：
 * 1) DELETE 掉上游已下线的模型；
 * 2) jsonb_to_recordset 一次性 upsert 全部模型（逐条 INSERT 会产生数百次网络往返，耗时以分钟计）。
 */
export async function writeCatalogSnapshot(models: ComputeModel[]): Promise<void> {
  const pool = getPool()
  if (!pool) return

  const rows = models.map((model) => ({
    id: model.id,
    model_id: model.modelId,
    gateway_model_id: model.gatewayModelId ?? null,
    provider_id: model.providerId ?? null,
    provider_name: model.providerName ?? null,
    type: model.type,
    name: model.name,
    input_price: model.inputPricePerMillionUsd ?? null,
    output_price: model.outputPricePerMillionUsd ?? null,
    context_length: model.contextLength ?? null,
    status: model.status ?? null,
    data_source: model.dataSource,
    payload: model,
  }))

  const client = await pool.connect()
  try {
    await client.query("BEGIN")

    if (rows.length > 0) {
      await client.query(
        `DELETE FROM model_catalog WHERE NOT (id = ANY($1::text[]))`,
        [rows.map((row) => row.id)],
      )
    } else {
      await client.query(`DELETE FROM model_catalog`)
    }

    if (rows.length > 0) {
      await client.query(
        `INSERT INTO model_catalog (
           id, model_id, gateway_model_id, provider_id, provider_name, type, name,
           input_price, output_price, context_length, status, data_source, payload, synced_at, updated_at
         )
         SELECT
           x.id, x.model_id, x.gateway_model_id, x.provider_id, x.provider_name, x.type, x.name,
           x.input_price, x.output_price, x.context_length, x.status, x.data_source, x.payload, now(), now()
         FROM jsonb_to_recordset($1::jsonb) AS x(
           id text, model_id text, gateway_model_id text, provider_id text, provider_name text,
           type text, name text, input_price numeric, output_price numeric,
           context_length integer, status text, data_source text, payload jsonb
         )
         ON CONFLICT (id) DO UPDATE SET
           model_id = EXCLUDED.model_id,
           gateway_model_id = EXCLUDED.gateway_model_id,
           provider_id = EXCLUDED.provider_id,
           provider_name = EXCLUDED.provider_name,
           type = EXCLUDED.type,
           name = EXCLUDED.name,
           input_price = EXCLUDED.input_price,
           output_price = EXCLUDED.output_price,
           context_length = EXCLUDED.context_length,
           status = EXCLUDED.status,
           data_source = EXCLUDED.data_source,
           payload = EXCLUDED.payload,
           synced_at = now(),
           updated_at = now()`,
        [JSON.stringify(rows)],
      )
    }

    await client.query(
      `UPDATE model_catalog_sync
       SET source = 'ai-gateway', model_count = $1, synced_at = now(), syncing_at = NULL,
           last_error = NULL, failed_at = NULL
       WHERE id = 1`,
      [models.length],
    )

    await client.query("COMMIT")
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

/**
 * 认领同步权：仅当无人持有锁（或锁已超时释放）时返回 true。
 * 并发场景下其他实例直接使用现有快照，避免同时回源打爆上游限额。
 */
export async function claimCatalogSync(lockTimeoutSeconds = 120): Promise<boolean> {
  if (!isDatabaseConfigured()) return true

  try {
    const result = await query<{ id: number }>(
      `UPDATE model_catalog_sync
       SET syncing_at = now()
       WHERE id = 1
         AND (syncing_at IS NULL OR syncing_at < now() - ($1 || ' seconds')::interval)
       RETURNING id`,
      [String(lockTimeoutSeconds)],
    )
    return result.rowCount > 0
  } catch (error) {
    console.error("[model-catalog] 认领同步锁失败:", error instanceof Error ? error.message : error)
    // 锁机制不可用时降级为「允许同步」，避免目录永久停滞
    return true
  }
}

/**
 * 释放同步锁并记录结果。
 * 失败时写入 failed_at —— 客户端据此判断退避窗口，避免每次渲染都重试同一个坏 key。
 */
export async function releaseCatalogSync(ok: boolean, options?: { count?: number; error?: string }): Promise<void> {
  if (!isDatabaseConfigured()) return
  try {
    await query(
      `UPDATE model_catalog_sync
       SET syncing_at = NULL,
           synced_at = CASE WHEN $1 THEN now() ELSE synced_at END,
           model_count = CASE WHEN $1 THEN $2 ELSE model_count END,
           last_error = $3,
           failed_at = CASE WHEN $1 THEN NULL ELSE now() END
       WHERE id = 1`,
      [ok, options?.count ?? 0, ok ? null : (options?.error ?? "UNKNOWN")],
    )
  } catch (error) {
    console.error("[model-catalog] 释放同步锁失败:", error instanceof Error ? error.message : error)
  }
}

/**
 * 带 Next Data Cache 的快照读取：一次 TTL 内只真正读库一次。
 * 目录全量约 0.5MB，按请求直读会把带宽与延迟放大到每次页面渲染，
 * 因此这里做一层进程/边缘缓存；同步成功后由 client.ts 主动 revalidateTag 失效。
 */
const readCachedSnapshotImpl = unstable_cache(
  async () => readCatalogSnapshot(),
  ["model-catalog-snapshot"],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: [CATALOG_CACHE_TAG] },
)

export async function readCachedCatalogSnapshot(): Promise<CatalogSnapshot | null> {
  try {
    return await readCachedSnapshotImpl()
  } catch (error) {
    console.error("[model-catalog] 读取缓存快照失败，回源直查:", error instanceof Error ? error.message : error)
    return readCatalogSnapshot()
  }
}

/**
 * 只读同步元信息（单行、不带模型），**不走 Data Cache**。
 *
 * 退避判定必须读到最新的 failed_at：如果复用 readCachedCatalogSnapshot，
 * 拿到的会是失败发生前缓存下来的快照（failed_at 为空），
 * 判定永远不成立 → 每次渲染都重新打上游，退避形同虚设。
 */
export interface CatalogSyncMeta {
  lastError: string | null
  failedAt: string | null
  syncedAt: string | null
}

export async function readCatalogSyncMeta(): Promise<CatalogSyncMeta | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const { rows } = await query<{
      last_error: string | null
      failed_at: Date | null
      synced_at: Date
    }>(
      `SELECT last_error, failed_at, synced_at FROM model_catalog_sync WHERE id = 1`,
    )
    const row = rows[0]
    if (!row) return null
    return {
      lastError: row.last_error,
      failedAt: row.failed_at ? row.failed_at.toISOString() : null,
      syncedAt: row.synced_at ? row.synced_at.toISOString() : null,
    }
  } catch (error) {
    console.error(
      "[model-catalog] 读取同步元信息失败:",
      error instanceof Error ? error.message : error,
    )
    return null
  }
}

/** 单行读取：详情页按 slug 取模型，避免为一条数据拉取整个目录 */
export async function readCatalogModelById(id: string): Promise<ComputeModel | null> {
  if (!isDatabaseConfigured()) return null
  try {
    const result = await query<{ payload: ComputeModel }>(
      `SELECT payload FROM model_catalog WHERE id = $1 LIMIT 1`,
      [id],
    )
    return result.rows[0]?.payload ?? null
  } catch (error) {
    console.error("[model-catalog] 读取单条模型失败:", error instanceof Error ? error.message : error)
    return null
  }
}

/** 供应商列表由模型派生（复用 service 层实现，避免结构漂移） */
