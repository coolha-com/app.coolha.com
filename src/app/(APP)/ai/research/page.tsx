import type { Metadata } from "next"
import { RiShieldCheckLine, RiSearchLine } from "react-icons/ri"
import { ModulePage } from "@/components/compute/ModulePage"
import { ResearchCockpit } from "@/components/compute/ResearchCockpit"

export const metadata: Metadata = {
  title: "投前侦察",
  description:
    "在签名任何交易之前，让 AI 把链上数据、合约安全、项目方背景、代币风险与媒体情绪一次性挖一遍，生成报告；决定执行时再给出逐步签名草稿。",
}

/**
 * 投前侦察（Pre-Investment Recon）。
 *
 * 场景：用户准备和一个合约交互 / 买代币 / 做 RWA 分析之前，先来这里挖一遍。
 * AI 跑五个维度（合约安全 / 项目方 / 代币风险 / 链上数据 / 媒体情绪），
 * 产出结构化报告；用户决定执行时，AI 再给出可逐步签名的步骤草稿
 * —— 服务端不持钥，符合「先出草稿再签名」的红线的实现方式。
 *
 * 数据诚实纪律：只呈现真实抓取到的数据。
 * - 已接入真实源：合约安全（Sourcify + Alchemy）、链上数据（Alchemy）、代币（DefiLlama）
 * - 未接入：项目方 / 团队（需实体图谱）、媒体情绪（需社交聚合源）
 *   → 这两类维度标记 unavailable，不给任何数值与判断，绝不用样例数据填充。
 */
export default function ResearchPage() {
  return (
    <ModulePage
      title="投前侦察"
      description="在签名任何交易之前，先让 AI 把链上数据、合约安全、项目方背景、代币风险与媒体情绪一次性挖一遍。报告出来你再决定是否动手——要执行，AI 会把每一步拆成需你签名的草稿。"
    >
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <RiSearchLine className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-medium">别在 FOMO 里签名，先在链上挖一遍</p>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            输入一个合约地址、代币或项目，AI 会并行跑五条侦察线：
            <span className="text-foreground">合约是否验证开源、代币真实价格与 TVL、链上余额与交易数、项目方背景、舆论热度</span>。
            其中
            <span className="text-foreground">合约安全 / 链上数据 / 代币风险已接入真实数据源</span>
            （Sourcify、Alchemy、DefiLlama）；
            <span className="text-foreground">项目方与媒体情绪的数据源尚未接入，这两条线不给任何数值</span>
            ——不做无依据的推测。
          </p>
        </div>
      </div>

      <ResearchCockpit />

      <section className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: RiShieldCheckLine,
            title: "先侦察，后签名",
            text: "把「冲动交互」变成「带报告决策」。每一项风险都给出口径明确的信号与建议。",
          },
          {
            icon: RiSearchLine,
            title: "只报真实数据",
            text: "已接 Sourcify / Alchemy / DefiLlama，指标均为真实抓取。未接入的维度直接标「未接入」并留空，不用样例数据冒充。",
          },
          {
            icon: RiShieldCheckLine,
            title: "执行不碰私钥",
            text: "决定动手时，AI 只生成交易草稿并展示 gas 与影响，真正签名永远由你的钱包完成。",
          },
        ].map((c) => {
          const Icon = c.icon
          return (
            <div key={c.title} className="rounded-2xl border bg-card p-4">
              <Icon className="size-5 text-primary" aria-hidden />
              <p className="mt-2 text-sm font-medium">{c.title}</p>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">{c.text}</p>
            </div>
          )
        })}
      </section>
    </ModulePage>
  )
}
