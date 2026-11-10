import type { Metadata } from "next"
import { RiCompass3Line, RiDatabase2Line } from "react-icons/ri"

import { EntryCard, PageHeader, PageShell } from "@/components/PageShell"

export const metadata: Metadata = {
  title: "数据和接口",
  description: "已有的链上工具与 RWA 数据入口。",
}

const LINKS = [
  {
    href: "/data/tools",
    title: "Web3 工具",
    text: "工具目录。只有标成已接入的只读工具可以实测。",
    icon: RiCompass3Line,
  },
  {
    href: "/rwa",
    title: "RWA 数据",
    text: "现有 RWA 行情页。",
    icon: RiDatabase2Line,
  },
]

export default function DataPage() {
  return (
    <PageShell>
      <PageHeader
        title="数据和接口"
        description="这里只链到已经存在的数据页。模型 API 不在这里售卖；赞助模型与浏览器 BYOK 在 RWA Research 的 Profile 里选择。"
      />

      <div className="grid gap-3">
        {LINKS.map((item) => (
          <EntryCard
            key={item.href}
            title={item.title}
            description={item.text}
            href={item.href}
            hrefLabel="打开"
            icon={item.icon}
          />
        ))}
      </div>
    </PageShell>
  )
}
