'use client'

import Link from 'next/link'

const sections = [
   {
      title: 'RWA',
      href: '/find/rwa',
      description: '真实世界资产代币化市场',
      badge: 'Coming Soon',
   },
   {
      title: 'DeFi',
      href: '/find/defi',
      description: '链上余额宝 / 理财超市。支持选择 APY 偏好组合并查看风险等级。',
      badge: 'Live',
   },
]

export default function FindPage() {
   return (
      <main className="min-h-[calc(100dvh-120px)] w-full bg-background px-4 py-4 md:px-6 md:py-6">
         <section className="mx-auto w-full max-w-6xl space-y-6">
            <section className="grid gap-4 md:grid-cols-2">
               {sections.map((section) => (
                  <article key={section.href} className="rounded-3xl border border-border bg-card/90 p-6 shadow-sm backdrop-blur">
                     <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold">{section.title}</h2>
                        <span
                           className={`rounded-full px-3 py-1 text-xs ${section.badge === 'Live' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                              }`}
                        >
                           {section.badge}
                        </span>
                     </div>
                     <p className="mt-3 text-sm text-muted-foreground">{section.description}</p>
                     <Link
                        href={section.href}
                        className="mt-6 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                     >
                        进入 {section.title}
                     </Link>
                  </article>
               ))}
            </section>
         </section>
      </main>
   )
}
