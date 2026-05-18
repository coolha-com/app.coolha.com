import type { Metadata } from 'next'
import { AlertSubscriptionPanel } from '@/components/ai/AlertSubscriptionPanel'
import { AssetAnalysisCard } from '@/components/ai/AssetAnalysisCard'
import { LiquidationAlert } from '@/components/ai/LiquidationAlert'
import { PortfolioSuggestion } from '@/components/ai/PortfolioSuggestion'
import { WhaleTracker, type WhaleTrade } from '@/components/ai/WhaleTracker'
import { seedMockAlerts } from '@/lib/ai/alertEngine'
import { generateAnalysis, generatePortfolio } from '@/lib/ai/aiService'

export const metadata: Metadata = {
  title: 'AI RWA Intelligence',
  description: 'Mock AI analysis, onchain tracking, alerts, and portfolio advisor for RWA assets.',
}

const whaleTrades: WhaleTrade[] = [
  {
    wallet: '0x8a3f...91c2',
    asset: 'Treasury Vault',
    action: 'Buy',
    amount: '$1.24M',
    flow: '7d net inflow +18%',
    riskHint: '短债类资产吸收稳定币流入，AI 判断短期流动性压力较低。',
  },
  {
    wallet: '0x19fd...44aa',
    asset: 'Invoice Pool Alpha',
    action: 'Sell',
    amount: '$420K',
    flow: '24h outflow spike',
    riskHint: '应收账款池出现集中赎回，建议同步观察逾期率与折价变化。',
  },
  {
    wallet: '0x7bb1...d203',
    asset: 'US Credit Note',
    action: 'Rotate',
    amount: '$860K',
    flow: 'Credit -> Treasury',
    riskHint: '大户从高收益信贷转向国债，可能代表风险偏好下行。',
  },
]

export default function AiPage() {
  const analysis = generateAnalysis('treasury-vault')
  const alerts = seedMockAlerts(['treasury-vault', 'invoice-pool-alpha', 'us-credit-note'], 3)
  const portfolio = generatePortfolio({
    userId: 'mock-user',
    riskTolerance: 'balanced',
    focus: 'diversification',
  })

  return (
    <main className="min-h-[calc(100dvh-120px)] w-full bg-background px-4 py-5 md:px-6 md:py-7">
      <section className="mx-auto w-full max-w-7xl space-y-5">
        <header className="rounded-[28px] border border-border bg-card p-5 shadow-sm md:p-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">AI Intelligence</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground md:text-4xl">RWA AI analysis system</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Rule-based mock 服务层覆盖资产分析、链上追踪、风险推送和组合建议，后续可替换为模型与真实索引数据。
          </p>
        </header>

        <AssetAnalysisCard analysis={analysis} />

        <div className="grid gap-5 xl:grid-cols-2">
          <WhaleTracker trades={whaleTrades} />
          <LiquidationAlert alerts={alerts} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <PortfolioSuggestion portfolio={portfolio} />
          <AlertSubscriptionPanel />
        </div>
      </section>
    </main>
  )
}
