import Link from "next/link"
import {
  RiArrowRightLine,
  RiBankCardLine,
  RiCpuLine,
  RiRobot2Line,
} from "react-icons/ri"
import type { IconType } from "react-icons"

const entries: Array<{
  title: string
  description: string
  href: string
  icon: IconType
}> = [
  {
    title: "算力市场",
    description: "通过稳定币结算的 AI Token 中转与订阅会员服务。",
    href: "/ai",
    icon: RiCpuLine,
  },
  {
    title: "智能体市场",
    description: "用于订阅履约、对账与客服任务的智能体服务。",
    href: "/agent",
    icon: RiRobot2Line,
  },
  {
    title: "代币化市场",
    description: "基于 Uniswap 流动性的代币化真实资产交易入口。",
    href: "/rwa",
    icon: RiBankCardLine,
  },
]

export default function MarketPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-normal">市场</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          浏览 Coolha 提供的市场入口。所有交易与流动性均基于 Uniswap 与以太坊，Coolha 不托管用户资金。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(({ title, description, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:border-primary/60"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Icon className="size-6" />
              </div>
              <RiArrowRightLine className="size-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground" />
            </div>
            <h2 className="mt-4 font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}
