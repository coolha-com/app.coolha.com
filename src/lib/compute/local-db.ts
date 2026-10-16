"use client"

/**
 * IndexedDB 本地存储层（零依赖）。
 *
 * 为什么不用 localStorage：
 *   1. 容量 5–10MB，对话历史 + 图片附件很快撑爆；
 *   2. 同步 API，读写大会话会阻塞主线程；
 *   3. 只能存字符串，结构化查询做不到。
 *
 * 设计：三个 object store（threads / messages / meta）+ 一个轻量 promise 封装。
 * 所有读写都走这里，业务层不直接碰 IndexedDB API。
 *
 * 隐私边界：这是「本地优先」的**本地**那一半——数据只在这台设备的浏览器里，
 * 不上传、不同步，除非用户在设置里显式打开云端备份。
 */

const DB_NAME = "coolha-chat"
const DB_VERSION = 1

export const STORE_THREADS = "threads"
export const STORE_MESSAGES = "messages"
export const STORE_META = "meta"

export interface LocalThread {
  id: string
  title: string
  modelKey: string
  pinned: boolean
  messageCount: number
  createdAt: number
  updatedAt: number
  /** 已同步到云端的时间戳；null = 从未同步 */
  syncedAt: number | null
}

export interface LocalMessage {
  id: string
  threadId: string
  seq: number
  role: "user" | "assistant" | "system"
  /** AI SDK UIMessage parts（已剥离图片 dataUrl，只留文本与占位） */
  parts: unknown[]
  text: string
  modelKey: string | null
  source: "gateway" | "byok"
  inputTokens: number
  outputTokens: number
  createdAt: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("INDEXEDDB_UNAVAILABLE"))
  }
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_THREADS)) {
        db.createObjectStore(STORE_THREADS, { keyPath: "id" })
      }
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const store = db.createObjectStore(STORE_MESSAGES, { keyPath: "id" })
        store.createIndex("byThread", "threadId")
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("INDEXEDDB_OPEN_FAILED"))
    request.onblocked = () => reject(new Error("INDEXEDDB_BLOCKED"))
  })
  // 打开失败时清掉缓存，下次重试（例如隐私模式下偶发失败）
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

function run<T>(
  storeName: string,
  mode: IDBTransactionMode,
  body: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const request = body(tx.objectStore(storeName))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error("IDB_REQUEST_FAILED"))
      }),
  )
}

/** 是否可用（隐私模式 / 禁用存储时会 false） */
export async function isLocalDbAvailable(): Promise<boolean> {
  try {
    await openDb()
    return true
  } catch {
    return false
  }
}

// ---------- meta ----------

export async function readMeta<T>(key: string): Promise<T | null> {
  const row = await run<{ key: string; value: T } | undefined>(STORE_META, "readonly", (store) =>
    store.get(key),
  )
  return row ? row.value : null
}

export async function writeMeta(key: string, value: unknown): Promise<void> {
  await run(STORE_META, "readwrite", (store) => store.put({ key, value }))
}

// ---------- threads ----------

export async function listLocalThreads(): Promise<LocalThread[]> {
  const rows = await run<LocalThread[]>(STORE_THREADS, "readonly", (store) => store.getAll())
  return rows.sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
}

export async function getLocalThread(id: string): Promise<LocalThread | null> {
  const row = await run<LocalThread | undefined>(STORE_THREADS, "readonly", (store) => store.get(id))
  return row ?? null
}

export async function putLocalThread(thread: LocalThread): Promise<void> {
  await run(STORE_THREADS, "readwrite", (store) => store.put(thread))
}

export async function deleteLocalThread(id: string): Promise<void> {
  await run(STORE_THREADS, "readwrite", (store) => store.delete(id))
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, "readwrite")
    const index = tx.objectStore(STORE_MESSAGES).index("byThread")
    const cursorRequest = index.openCursor(IDBKeyRange.only(id))
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("IDB_TX_FAILED"))
    tx.onabort = () => reject(tx.error ?? new Error("IDB_TX_ABORTED"))
  })
}

export async function clearLocalThreads(): Promise<void> {
  await run(STORE_THREADS, "readwrite", (store) => store.clear())
  await run(STORE_MESSAGES, "readwrite", (store) => store.clear())
}

// ---------- messages ----------

export async function listLocalMessages(threadId: string): Promise<LocalMessage[]> {
  const rows = await run<LocalMessage[]>(STORE_MESSAGES, "readonly", (store) =>
    store.index("byThread").getAll(IDBKeyRange.only(threadId)),
  )
  return rows.sort((a, b) => a.seq - b.seq)
}

export async function countLocalMessages(): Promise<number> {
  return run<number>(STORE_MESSAGES, "readonly", (store) => store.count())
}

/** 全量替换某会话的消息（先删后插，与云端 replaceMessages 同语义） */
export async function replaceLocalMessages(threadId: string, messages: LocalMessage[]): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, "readwrite")
    const store = tx.objectStore(STORE_MESSAGES)
    // 删除与插入必须在同一个事务的活动期内完成：oncomplete 时事务已结束，put 会抛
    // TransactionInactiveError。用 openCursor 边遍历边删，遍历结束后再统一插入。
    const cursorRequest = store.index("byThread").openCursor(IDBKeyRange.only(threadId))
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
        return
      }
      for (const message of messages) store.put(message)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("IDB_TX_FAILED"))
    tx.onabort = () => reject(tx.error ?? new Error("IDB_TX_ABORTED"))
  })
}

/** 批量插入（用于从云端恢复；不动已有数据） */
export async function putLocalMessages(messages: LocalMessage[]): Promise<void> {
  if (messages.length === 0) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_MESSAGES, "readwrite")
    const store = tx.objectStore(STORE_MESSAGES)
    for (const message of messages) store.put(message)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("IDB_TX_FAILED"))
  })
}
