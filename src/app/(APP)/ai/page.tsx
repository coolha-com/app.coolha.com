"use client"

import { useEffect, useMemo, useState } from "react"
import { AssetAnalysisCard } from "@/components/ai/AssetAnalysisCard"
import { LiquidationAlert } from "@/components/ai/LiquidationAlert"
import { PortfolioSuggestion } from "@/components/ai/PortfolioSuggestion"
import { WhaleTracker, type WhaleTrade } from "@/components/ai/WhaleTracker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { generateMockAlert, seedMockAlerts, subscribeAsset, unsubscribeAsset } from "@/lib/ai/alertEngine"
import { generateAnalysis, generatePortfolio, listMockAssets } from "@/lib/ai/aiService"

const whaleTrades: WhaleTrade[] = [
  {
    wallet: "0x8f2...3ae1",
    asset: "Invoice Pool Alpha",
    action: "Buy",
    amount: "$1.8M",
    flow: "24h 净流入 +14.2%",
    riskHint: "鲸鱼地址正在持续建仓，短线提升了市场情绪，但也可能抬高赎回拥挤风险。",
  },
  {
    wallet: "0x19c...8b77",
    asset: "US Credit Note",
    action: "Rotate",
    amount: "$920K",
    flow: "从 Treasury Vault 切换至信用资产",
    riskHint: "资金正在从低波动仓位转向更高收益资产，说明收益偏好正在上升。",
  },
  {
    wallet: "0xaa1...f940",
    asset: "Real Estate Income",
    action: "Sell",
    amount: "$610K",
    flow: "48h 净流出 -6.5%",
    riskHint: "连续减仓通常意味着对现金流兑现速度存在担忧，需要结合结构数据观察。",
  },
]

export default function AiPage() {
  const assets = useMemo(() => listMockAssets(), [])
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?.id ?? "")
  const [subscribedAssets, setSubscribedAssets] = useState<string[]>(assets.slice(0, 2).map((asset) => asset.id))
  const [alerts, setAlerts] = useState(() => seedMockAlerts(assets.slice(0, 2).map((asset) => asset.id), 4))

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? assets[0],
    [assets, selectedAssetId]
  )
  const analysis = useMemo(() => generateAnalysis(selectedAsset), [selectedAsset])
  const portfolio = useMemo(
    () =>
      generatePortfolio({
        userId: "demo-user",
        riskTolerance: "balanced",
        focus: "income",
      }),
    []
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAlerts((current) => {
        const next = generateMockAlert(subscribedAssets)
        if (!next) return current
        return [next, ...current].slice(0, 6)
      })
    }, 4500)

    return () => window.clearInterval(timer)
  }, [subscribedAssets])

  const subscribedCount = subscribedAssets.length

  return (
    <main className="min-h-[calc(100dvh-120px)] bg-background px-3 py-3 text-foreground md:px-5 md:py-5">
      <section className="mx-auto max-w-7xl space-y-4">
        <header className="overflow-hidden rounded-[34px] border border-border bg-[radial-gradient(circle_at_top_left,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_30%),linear-gradient(180deg,color-mix(in_oklab,var(--card)_92%,transparent),color-mix(in_oklab,var(--muted)_36%,transparent))] p-5 shadow-sm backdrop-blur md:p-7">
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-primary/25 bg-primary/15 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-primary">
                AI Analysis System
              </div>
              <div>
                <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
                  用 AI 把 RWA 的收益、风险、链上资金流和组合建议放进同一个决策面板
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
                  真实分析接口、实时链上监听和个性化顾问服务。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">
                  收益来源拆解
                </span>
                <span className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">
                  风险评分生成
                </span>
                <span className="rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">
                  自动跟踪与推送
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              <div className="rounded-[26px] border border-border bg-card/85 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">跟踪资产</p>
                <p className="mt-3 text-3xl font-semibold text-foreground">{subscribedCount}</p>
                <p className="mt-1 text-xs text-muted-foreground">已订阅自动监控的资产数量</p>
              </div>
              <div className="rounded-[26px] border border-border bg-card/85 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">风险等级</p>
                <p className="mt-3 text-3xl font-semibold text-foreground">{analysis.risk.level}</p>
                <p className="mt-1 text-xs text-muted-foreground">当前选中资产 AI 评估结果</p>
              </div>
              <div className="rounded-[26px] border border-border bg-card/85 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">组合收益</p>
                <p className="mt-3 text-3xl font-semibold text-foreground">{portfolio.expectedYield}%</p>
                <p className="mt-1 text-xs text-muted-foreground">AI Advisor 推荐篮子的预期收益</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_380px]">
          <div className="space-y-4">
            <AssetAnalysisCard analysis={analysis} />

            <section className="grid gap-4 xl:grid-cols-2">
              <WhaleTracker trades={whaleTrades} />
              <LiquidationAlert alerts={alerts} />
            </section>
          </div>

          <aside className="space-y-4">
            <Card className="rounded-[28px] border-border bg-card shadow-none">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-foreground">Asset Watchlist</CardTitle>
                <CardDescription className="text-muted-foreground">
                  选择资产并订阅自动跟踪系统，页面会模拟推送风险变化、收益变化和异常事件。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                {assets.map((asset) => {
                  const active = asset.id === selectedAssetId
                  const subscribed = subscribedAssets.includes(asset.id)

                  return (
                    <article
                      key={asset.id}
                      className={`rounded-[24px] border p-4 transition-colors ${
                        active ? "border-primary/35 bg-primary/10" : "border-border bg-background/70"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{asset.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{asset.category}</p>
                        </div>
                        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
                          {asset.baseYield}%
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          variant={active ? "default" : "outline"}
                          className={active ? "" : "bg-background"}
                          onClick={() => setSelectedAssetId(asset.id)}
                        >
                          查看分析
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-foreground hover:bg-accent hover:text-accent-foreground"
                          onClick={() =>
                            setSubscribedAssets((current) =>
                              subscribed ? unsubscribeAsset(current, asset.id) : subscribeAsset(current, asset.id)
                            )
                          }
                        >
                          {subscribed ? "取消订阅" : "订阅资产"}
                        </Button>
                      </div>
                    </article>
                  )
                })}
              </CardContent>
            </Card>

            <PortfolioSuggestion portfolio={portfolio} />
          </aside>
        </section>
      </section>
    </main>
  )
}
