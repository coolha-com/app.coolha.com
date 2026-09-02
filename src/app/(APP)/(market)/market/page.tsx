import Link from "next/link"
import {
  RiArrowRightLine,
  RiCpuLine,
  RiExchangeDollarLine,
  RiPuzzleLine,
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
      title: "AI Model APIs",
      description: "Buy access to AI model compute through wallet-based API usage.",
      href: "/ai",
      icon: RiCpuLine,
    },
    {
      title: "Agent Services",
      description: "Discover agents that provide verifiable real-world services.",
      href: "/agent",
      icon: RiRobot2Line,
    },
    {
      title: "Extensions & Skills",
      description: "Browse extensions, skills, and integrations for your agent.",
      href: "/discover",
      icon: RiPuzzleLine,
    },
    {
      title: "RWA Assets",
      description: "Browse tokenized real-world assets with full disclosure.",
      href: "/rwa",
      icon: RiExchangeDollarLine,
    },
  ]

export default function MarketPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">


      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
