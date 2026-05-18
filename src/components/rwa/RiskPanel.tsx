import type { RWAAsset } from '@/lib/rwa/types'
import { RiskScoreBadge } from './RiskScoreBadge'

function riskNarrative(score: number): string {
  if (score <= 25) return '风险偏低：以合规资产与短久期底层为主，适合稳健配置。'
  if (score <= 45) return '风险适中：收益与锁仓周期更偏中性，需关注赎回与协议条款。'
  if (score <= 65) return '风险偏高：对流动性与底层资产质量更敏感，建议分散与控制仓位。'
  return '高风险：对市场与协议变量高度敏感，适合专业用户与小仓位策略。'
}

function scoreBand(score: number): string {
  if (score <= 15) return 'AAA'
  if (score <= 55) return 'BBB'
  return 'High Risk'
}

export function RiskPanel(props: { asset: RWAAsset }) {
  const { asset } = props
  return (
    <section className="rounded-[28px] border border-border bg-card/95 p-5 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">AI Risk Score</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">AI 风险评分组件</h2>
        </div>
        <RiskScoreBadge score={asset.riskScore} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[24px] border border-border bg-muted/20 p-4">
          <p className="text-sm leading-6 text-muted-foreground">{riskNarrative(asset.riskScore)}</p>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${
                asset.riskScore <= 25 ? 'bg-emerald-400' : asset.riskScore <= 55 ? 'bg-amber-400' : 'bg-rose-400'
              }`}
              style={{ width: `${Math.max(8, Math.min(100, asset.riskScore))}%` }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-[22px] border border-border bg-background p-4">
            <p className="text-muted-foreground">分数</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{Math.round(asset.riskScore)}</p>
          </div>
          <div className="rounded-[22px] border border-border bg-background p-4">
            <p className="text-muted-foreground">等级</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{scoreBand(asset.riskScore)}</p>
          </div>
          <div className="rounded-[22px] border border-border bg-background p-4">
            <p className="text-muted-foreground">协议来源</p>
            <p className="mt-2 text-sm font-medium text-foreground">{asset.protocol.name}</p>
          </div>
          <div className="rounded-[22px] border border-border bg-background p-4">
            <p className="text-muted-foreground">流动性</p>
            <p className="mt-2 text-sm font-medium text-foreground">{asset.liquidityType === 'liquid' ? '可赎回' : '锁仓'}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
