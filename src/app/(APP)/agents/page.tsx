import type { Metadata } from "next"
import { RiCpuLine, RiRobot2Line, RiSearchLine } from "react-icons/ri"

import { EntryCard, PageHeader, PageShell, SectionHeading } from "@/components/PageShell"

export const metadata: Metadata = {
  title: "智能服务",
  description: "已交付的 Agent 服务目录。未上线的服务不能进入。",
}

const UNRELEASED = ["Contract Audit", "DeFi Analytics"]

export default function AgentsPage() {
  return (
    <PageShell>
      <PageHeader
        title="智能服务"
        description="目录里只有已经交付的服务可以进入。未上线的名称只作占位，不能下单，也没有配置页。"
      />

      <div className="grid gap-3">
        <EntryCard
          title="RWA Research"
          description="只读研究。保存 Profile 后提交任务，查看带来源和时间的报告。订单付款状态为未付款。"
          href="/agents/rwa-research"
          hrefLabel="打开 RWA Research"
          icon={RiRobot2Line}
          status="可进入"
        />
        <EntryCard
          title="投前侦察"
          description="只读研究页，数据来自已接入的研究管线。"
          href="/agents/research"
          hrefLabel="打开投前侦察"
          icon={RiSearchLine}
          status="可进入"
        />
        {UNRELEASED.map((name) => (
          <EntryCard
            key={name}
            title={name}
            description="尚未交付，不能进入，也不能下单。"
            status="未上线"
            muted
          />
        ))}
      </div>

      <SectionHeading>页面入口</SectionHeading>
      <div className="grid gap-3 sm:grid-cols-2">
        <EntryCard
          title="模型广场"
          description="平台模型目录与上游价格参考；模型由 Coolha 统一提供，在智能对话里选用。"
          href="/console/models"
          hrefLabel="打开模型广场"
          icon={RiCpuLine}
          status="可进入"
        />
      </div>
    </PageShell>
  )
}
