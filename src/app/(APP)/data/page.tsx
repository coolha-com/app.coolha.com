import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Data & APIs",
  description: "已有的链上工具、投前侦察和 RWA 数据入口。",
}

const LINKS = [
  {
    href: "/ai/tools",
    title: "Web3 工具",
    text: "工具目录。只有标成已接入的只读工具可以实测。",
  },
  {
    href: "/ai/research",
    title: "投前侦察",
    text: "现有只读研究页，数据来自已接入的研究管线。",
  },
  {
    href: "/rwa",
    title: "RWA 数据",
    text: "现有 RWA 行情页。",
  },
]

export default function DataPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-normal">Data & APIs</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        这里只链到已经存在的数据页。模型 API 不在这里售卖；赞助模型与浏览器 BYOK 在 RWA Research 的 Profile 里选择。
      </p>
      <ul className="mt-6 space-y-3">
        {LINKS.map((item) => (
          <li key={item.href} className="rounded-2xl border bg-card p-4">
            <h2 className="text-base font-medium">{item.title}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</p>
            <Link href={item.href} className="mt-3 inline-flex text-sm font-medium underline-offset-4 hover:underline">
              打开
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
