"use client"

import { useCallback, useEffect, useState } from "react"
import {
  RiAlertLine,
  RiCloudLine,
  RiComputerLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiRefreshLine,
  RiShieldCheckLine,
  RiUploadLine,
} from "react-icons/ri"
import { Button } from "@/components/ui/button"
import { useWalletAuth } from "@/hooks/useWalletAuth"
import { PLANS, isPlanId } from "@/lib/compute/plans"
import {
  clearCloudHistory,
  createCloudThread,
  loadCloudThread,
  refreshCloudThreads,
  saveCloudMessages,
  useCloudThreads,
} from "@/lib/compute/cloud-threads"
import {
  clearLocalHistory,
  loadThread,
  localStats,
  markThreadSynced,
  mergeCloudMessages,
  setStorageMode,
  upsertLocalThread,
  useThreadStore,
  type StorageMode,
} from "@/lib/compute/thread-store"

/**
 * 数据存放位置与隐私。
 *
 * 承诺必须能被验证，所以这里把「存了什么 / 不存什么」逐条写死：
 * - 本机：对话正文、角色、模型标识、token 用量、时间（IndexedDB）
 * - 云端（可选备份）：同样的对话正文，仅在用户显式开启且档位含云历史时写入
 * - 绝不存：任何 API Key、图片与文件的二进制（上报前已剥离为「[附件]」占位符）
 */

type Busy = "none" | "backup" | "restore" | "clear-local" | "clear-cloud"

export function CloudHistorySettings() {
  const { signedIn } = useWalletAuth()
  const store = useThreadStore()
  const cloud = useCloudThreads()
  const [stats, setStats] = useState<{ threads: number; messages: number; dbAvailable: boolean } | null>(null)
  const [busy, setBusy] = useState<Busy>("none")
  const [confirming, setConfirming] = useState<"none" | "clear-local" | "clear-cloud">("none")
  const [message, setMessage] = useState<string | null>(null)

  const refreshStats = useCallback(() => {
    void localStats().then(setStats)
  }, [])

  useEffect(() => {
    if (store.ready) refreshStats()
  }, [store.ready, store.threads, refreshStats])

  const plan = isPlanId(cloud.plan) ? PLANS[cloud.plan] : PLANS.free
  const days = plan.limits.historyDays
  const backupAllowed = signedIn && cloud.status === "ready"

  const onModeChange = async (next: StorageMode) => {
    if (next === "backup" && !backupAllowed) {
      setMessage(signedIn ? "当前档位不含云端备份，升级 Plus 起可开启。" : "请先连接钱包并签名登录。")
      return
    }
    setBusy("backup")
    setMessage(null)
    await setStorageMode(next)
    setBusy("none")
    setMessage(
      next === "backup"
        ? "已开启云端备份：本地仍是读源，云端只是镜像。"
        : "已切回本地优先：云端不再写入。",
    )
  }

  /** 手动把本地全量推到云端（开启备份后的首次同步） */
  const onBackupNow = async () => {
    setBusy("backup")
    setMessage(null)
    try {
      let pushed = 0
      for (const summary of store.threads) {
        const detail = await loadThread(summary.id)
        if (!detail || detail.messages.length === 0) continue
        const first = detail.messages.find((item) => item.role === "user")
        const created = await createCloudThread({
          id: summary.id,
          title: first?.text.slice(0, 24) || summary.title,
          modelKey: summary.modelKey,
        })
        if (!created.id) continue
        const result = await saveCloudMessages(summary.id, {
          messages: detail.messages.map((item) => ({
            role: item.role === "assistant" ? ("assistant" as const) : ("user" as const),
            parts: [{ type: "text" as const, text: item.text }],
            text: item.text,
            modelKey: item.modelKey,
            source: item.source,
          })),
          title: summary.title,
          modelKey: summary.modelKey,
        })
        if (result.ok) {
          await markThreadSynced(summary.id)
          pushed += 1
        }
      }
      await refreshCloudThreads()
      refreshStats()
      setMessage(`已推送 ${pushed} 条会话到云端。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "备份失败，请重试")
    } finally {
      setBusy("none")
    }
  }

  /** 从云端恢复：合入本地，不覆盖本地较新的记录 */
  const onRestore = async () => {
    setBusy("restore")
    setMessage(null)
    try {
      const response = await fetch("/api/chat/threads", { credentials: "same-origin" })
      if (!response.ok) throw new Error("读取云端列表失败")
      const json = (await response.json()) as {
        threads?: Array<{
          id: string
          title: string
          modelKey: string | null
          pinned: boolean
          updatedAt: string
        }>
      }
      let restored = 0
      for (const thread of json.threads ?? []) {
        const detail = await loadCloudThread(thread.id)
        if (!detail) continue
        const cloudUpdated = Date.parse(thread.updatedAt) || 0
        const local = await loadThread(thread.id)
        // 本地优先：本地已有且不落后于云端 → 跳过，不被覆盖
        if (local && local.thread.updatedAt >= cloudUpdated) continue
        await upsertLocalThread({
          id: thread.id,
          title: thread.title,
          modelKey: thread.modelKey ?? "",
          pinned: thread.pinned,
          messageCount: detail.messages.length,
          createdAt: cloudUpdated || Date.now(),
          updatedAt: cloudUpdated || Date.now(),
          syncedAt: Date.now(),
        })
        await mergeCloudMessages(
          detail.messages.map((item, index) => ({
            id: item.id,
            threadId: thread.id,
            seq: index,
            role: item.role,
            parts: item.parts,
            text: item.text,
            modelKey: item.modelKey,
            source: item.source,
            inputTokens: 0,
            outputTokens: 0,
            createdAt: Date.parse(item.createdAt) || Date.now(),
          })),
        )
        restored += 1
      }
      await refreshCloudThreads()
      refreshStats()
      setMessage(`已从云端恢复 ${restored} 条会话（未覆盖本地较新的记录）。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "恢复失败，请重试")
    } finally {
      setBusy("none")
    }
  }

  const onClearLocal = async () => {
    setBusy("clear-local")
    setMessage(null)
    try {
      const removed = await clearLocalHistory()
      setConfirming("none")
      refreshStats()
      setMessage(`已清空本机 ${removed} 条会话。云端备份不受影响。`)
    } finally {
      setBusy("none")
    }
  }

  const onClearCloud = async () => {
    setBusy("clear-cloud")
    setMessage(null)
    try {
      const result = await clearCloudHistory()
      if (!result.ok) {
        setMessage(result.message ?? "清空云端失败")
        return
      }
      // 云端清空后把本地会话标为已同步，避免下次又被推上去
      for (const thread of store.threads) await markThreadSynced(thread.id)
      setConfirming("none")
      setMessage(`已清空云端备份 ${result.removed ?? 0} 条。本机记录不受影响。`)
    } finally {
      setBusy("none")
    }
  }

  return (
    <div className="space-y-4">
      {/* 存储模式 */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <RiShieldCheckLine className="size-4 text-primary" />
          <h2 className="text-sm font-medium">数据存放位置</h2>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Coolha 采用<strong className="font-medium text-foreground">本地优先</strong>架构：对话默认只保存在你这台设备的浏览器里，
          不上传、不同步。云端仅作为可选的跨设备备份。
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <ModeCard
            active={store.mode === "local"}
            icon={<RiComputerLine className="size-4" />}
            title="本地优先"
            description="对话只存本机，零服务端接触"
            disabled={busy !== "none"}
            onClick={() => void onModeChange("local")}
          />
          <ModeCard
            active={store.mode === "backup"}
            icon={<RiCloudLine className="size-4" />}
            title="云端备份"
            description={
              backupAllowed
                ? "本机仍为读源，云端做镜像，可跨设备恢复"
                : signedIn
                  ? "需 Plus 及以上档位"
                  : "需先签名登录"
            }
            disabled={busy !== "none" || !backupAllowed}
            onClick={() => void onModeChange("backup")}
          />
        </div>

        {!store.dbAvailable ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive">
            <RiAlertLine className="mt-0.5 size-3.5 shrink-0" />
            浏览器存储不可用（可能是隐私模式或空间不足），本次对话不会被保存。
          </p>
        ) : null}
      </div>

      {/* 备份操作 */}
      {store.mode === "backup" ? (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <RiCloudLine className="size-4 text-primary" />
            <h2 className="text-sm font-medium">云端备份</h2>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            保留期：
            {days === 0 ? "当前档位不含云端历史" : days === null ? "永久" : `${days} 天`}
            {plan.limits.historyThreads !== null ? ` · 最多 ${plan.limits.historyThreads} 条` : ""}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              disabled={busy !== "none"}
              onClick={() => void onBackupNow()}
            >
              <RiUploadLine className="size-3.5" />
              {busy === "backup" ? "备份中…" : "立即备份到云端"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              disabled={busy !== "none"}
              onClick={() => void onRestore()}
            >
              <RiDownloadLine className="size-3.5" />
              {busy === "restore" ? "恢复中…" : "从云端恢复"}
            </Button>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            恢复为合并不覆盖：本地较新的记录不会被云端版本顶掉。
          </p>
        </div>
      ) : null}

      {/* 存什么 / 不存什么 */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-medium">存什么，不存什么</h2>
        <dl className="mt-4 space-y-2 text-xs leading-5">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted-foreground">本机存储</dt>
            <dd>
              对话正文、角色、模型标识、token 用量、时间。存于浏览器 IndexedDB，
              容量远大于 localStorage，可容纳长会话。
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted-foreground">云端备份</dt>
            <dd>
              同样的对话正文。仅在开启「云端备份」且档位含云历史时写入；
              切回本地优先后立即停止上传，已有备份可在下方单独清空。
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted-foreground">绝不存</dt>
            <dd>
              你的 API Key（只留在浏览器，从不上行）、图片与文件的二进制内容
              （上报前已剥离为「[附件]」占位符）。
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-muted-foreground">当前规模</dt>
            <dd>
              {stats ? `${stats.threads} 条会话 · ${stats.messages} 条消息` : "统计中…"}
            </dd>
          </div>
        </dl>
      </div>

      {/* 清空 */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-medium">清空数据</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          本地与云端各自独立清空，互不影响。两者均不可恢复。
        </p>
        <div className="mt-4 space-y-2">
          {confirming === "clear-local" ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3">
              <p className="flex items-start gap-1.5 text-xs leading-5 text-destructive">
                <RiAlertLine className="mt-0.5 size-3.5 shrink-0" />
                将删除本机全部 {stats?.threads ?? 0} 条会话，无法恢复。云端备份不受影响。
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  className="rounded-xl"
                  disabled={busy !== "none"}
                  onClick={() => void onClearLocal()}
                >
                  {busy === "clear-local" ? "清空中…" : "确认清空本机"}
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setConfirming("none")}>
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              disabled={!store.dbAvailable || busy !== "none"}
              onClick={() => setConfirming("clear-local")}
            >
              <RiDeleteBinLine className="size-3.5" />
              清空本机数据
            </Button>
          )}

          {confirming === "clear-cloud" ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3">
              <p className="flex items-start gap-1.5 text-xs leading-5 text-destructive">
                <RiAlertLine className="mt-0.5 size-3.5 shrink-0" />
                将删除云端全部备份，无法恢复。本机记录不受影响。
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  className="rounded-xl"
                  disabled={busy !== "none"}
                  onClick={() => void onClearCloud()}
                >
                  {busy === "clear-cloud" ? "清空中…" : "确认清空云端"}
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setConfirming("none")}>
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              disabled={!backupAllowed || busy !== "none"}
              onClick={() => setConfirming("clear-cloud")}
            >
              <RiDeleteBinLine className="size-3.5" />
              清空云端备份
            </Button>
          )}
        </div>
      </div>

      {message ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RiRefreshLine className="size-3.5" />
          {message}
        </p>
      ) : null}
    </div>
  )
}

function ModeCard({
  active,
  icon,
  title,
  description,
  disabled,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  title: string
  description: string
  disabled?: boolean
  onClick: () => void
}) {
  const base =
    "rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50"
  const tone = active
    ? "border-primary bg-primary/5"
    : disabled
      ? "border-border opacity-60"
      : "border-border hover:border-primary/60"
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active} className={`${base} ${tone}`}>
      <span className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </span>
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
    </button>
  )
}
