'use client'

import { useMemo, useState } from 'react'
import { generateMockAlert, seedMockAlerts, subscribeAsset, unsubscribeAsset, type AssetAlert } from '@/lib/ai/alertEngine'
import { listMockAssets } from '@/lib/ai/aiService'

const severityTone: Record<AssetAlert['severity'], string> = {
  low: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  medium: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  high: 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300',
}

export function AlertSubscriptionPanel() {
  const assets = useMemo(() => listMockAssets(), [])
  const [subscribedAssetIds, setSubscribedAssetIds] = useState<string[]>(() => assets.slice(0, 2).map((asset) => asset.id))
  const [alerts, setAlerts] = useState<AssetAlert[]>(() => seedMockAlerts(assets.slice(0, 2).map((asset) => asset.id), 3))

  const toggleSubscription = (assetId: string) => {
    setSubscribedAssetIds((current) => {
      if (current.includes(assetId)) return unsubscribeAsset(current, assetId)
      return subscribeAsset(current, assetId)
    })
  }

  const pushMockAlert = () => {
    const next = generateMockAlert(subscribedAssetIds)
    if (!next) return
    setAlerts((current) => [next, ...current].slice(0, 6))
  }

  return (
    <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Auto Tracking</p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">资产订阅与 mock 推送</h2>
        </div>
        <button
          type="button"
          onClick={pushMockAlert}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          生成推送
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2">
          {assets.map((asset) => {
            const selected = subscribedAssetIds.includes(asset.id)
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => toggleSubscription(asset.id)}
                className={`flex w-full items-center justify-between rounded-[20px] border px-3 py-3 text-left transition ${
                  selected ? 'border-primary/30 bg-primary/10 text-foreground' : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>
                  <span className="block text-sm font-medium">{asset.name}</span>
                  <span className="mt-1 block text-xs opacity-80">{asset.category}</span>
                </span>
                <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px]">{selected ? 'Subscribed' : 'Off'}</span>
              </button>
            )
          })}
        </div>

        <div className="space-y-2">
          {alerts.map((alert) => (
            <article key={alert.id} className="rounded-[20px] border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{alert.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{alert.assetName}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] ${severityTone[alert.severity]}`}>{alert.delta}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{alert.message}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
