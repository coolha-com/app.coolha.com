import type { Metadata } from "next"
import {
  RiArrowRightUpLine,
  RiBankLine,
  RiExchangeLine,
  RiInformationLine,
  RiLockLine,
  RiShieldCheckLine,
} from "react-icons/ri"
import { MockNotice } from "@/components/compute/MockBadge"
import { ChainLogos, RwaLogo } from "@/components/rwa/RwaLogo"
import { TickerBoard } from "@/components/rwa/TickerBoard"
import { getRwaSnapshot } from "@/lib/rwa/client"
import { getTickerBoard, toGroupBoard } from "@/lib/rwa/markets"
import { formatPct, formatUsd, sortRwaAssets } from "@/lib/rwa/service"

export const metadata: Metadata = {
  title: "代币化资产数据聚合",
  description:
    "聚合 RWA 与代币化资产的一级市场申赎规模与二级市场链上流动性，展示发行方与底层资产类别，并提供发行方与 Uniswap 的直达入口。仅提供数据聚合与比较，不提供交易撮合、不托管资产。",
}

/**
 * 强制动态渲染。
 *
 * 数据层用的是进程内缓存（DefiLlama 1 小时 / CoinGecko 10 分钟），不走 Next Data Cache
 * ——两个上游响应都远超 Data Cache 的 2MB 上限。若让它参与静态预渲染，
 * build 阶段会因 no-store fetch 抛 dynamic-server-error 并被降级成空数据，
 * 白白拖慢构建还打出误导性日志。因此这里直接声明动态，缓存交给数据层。
 */
export const dynamic = "force-dynamic"

/** 首屏表格行数上限，其余走公开接口 */
const MAX_ROWS = 40

export default async function RwaAggregatorPage() {
  const [snapshot, tickers] = await Promise.all([getRwaSnapshot(), getTickerBoard()])
  const rows = sortRwaAssets(snapshot.assets, "primary-desc").slice(0, MAX_ROWS)
  const { totals } = snapshot
  const tickerCount =
    tickers.board.stocks.length + tickers.board.etfs.length + tickers.board.commodities.length

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">股票 / ETF / 大宗商品</h2>
          <span className="text-xs text-muted-foreground">
            CoinGecko · {tickerCount} 个代币{tickers.stale ? " · 部分为上次缓存" : ""}
          </span>
        </div>
        <div className="mt-4">
          <TickerBoard board={toGroupBoard(tickers.board)} />
        </div>
      </section>

      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-5">
          <h2 className="text-lg font-semibold">资产目录</h2>
          <span className="text-xs text-muted-foreground">
            按一级市场 TVL 排序 · {rows.length} / {totals.protocolCount}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="p-5 text-sm leading-6 text-muted-foreground">
            暂无已接入的真实代币化资产。上游数据恢复后会在此展示。
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-5 py-3 text-left font-medium">资产</th>
                  <th className="hidden px-3 py-3 text-left font-medium md:table-cell">发行方</th>
                  <th className="hidden px-3 py-3 text-left font-medium xl:table-cell">底层资产类别</th>
                  <th className="px-3 py-3 text-right font-medium">一级市场</th>
                  <th className="hidden px-3 py-3 text-right font-medium lg:table-cell">二级市场</th>
                  <th className="hidden px-3 py-3 text-right font-medium md:table-cell">二级占比</th>
                  <th className="hidden px-3 py-3 text-right font-medium xl:table-cell">池数</th>
                  <th className="hidden px-3 py-3 text-left font-medium lg:table-cell">链</th>
                  <th className="px-5 py-3 text-right font-medium">入口</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((asset) => (
                  <tr key={asset.id} className="border-b last:border-b-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <RwaLogo src={asset.logoUrl} name={asset.name} size={26} />
                        <div>
                          <div className="font-medium">{asset.name}</div>
                          <div className="text-xs text-muted-foreground">{asset.category}</div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-3 md:table-cell">
                      <div className="flex items-center gap-2">
                        <RwaLogo src={asset.issuerLogoUrl} name={asset.issuerName} size={18} />
                        <span className="max-w-[140px] truncate">{asset.issuerName}</span>
                        {asset.permissionedPoolIssuer ? (
                          <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                            Permissioned
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="hidden px-3 py-3 text-xs text-muted-foreground xl:table-cell">
                      {asset.assetClass}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {formatUsd(asset.primaryTvlUsd)}
                    </td>
                    <td className="hidden px-3 py-3 text-right tabular-nums lg:table-cell">
                      {formatUsd(asset.secondaryTvlUsd)}
                    </td>
                    <td className="hidden px-3 py-3 text-right tabular-nums md:table-cell">
                      {formatPct(asset.secondarySharePct)}
                    </td>
                    <td className="hidden px-3 py-3 text-right tabular-nums xl:table-cell">
                      {asset.dexPoolCount}
                    </td>
                    <td className="hidden px-3 py-3 lg:table-cell">
                      <ChainLogos chains={asset.chains} logos={asset.chainLogos} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {asset.primaryActionUrl && asset.primaryActionLabel ? (
                        <a
                          href={asset.primaryActionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition hover:border-primary/60 hover:text-primary"
                        >
                          {asset.primaryActionLabel}
                          <RiArrowRightUpLine className="size-3.5" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">流动性结构</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={RiBankLine}
            label="一级市场（申赎）"
            value={formatUsd(totals.primaryTvlUsd)}
            hint={`${totals.protocolCount} 个协议`}
          />
          <Stat
            icon={RiExchangeLine}
            label="二级市场（DEX）"
            value={formatUsd(totals.secondaryTvlUsd)}
            hint={`${totals.dexPoolCount} 个池子`}
          />
          <Stat
            icon={RiInformationLine}
            label="二级 / 一级"
            value={formatPct(totals.secondarySharePct)}
            hint="可自由转让的占比"
          />
          <Stat icon={RiLockLine} label="许可型为主" value="多数" hint="需白名单 / KYC" />
        </div>

        <details className="group mt-3 rounded-2xl border bg-card p-5">
          <summary className="cursor-pointer list-none text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <RiInformationLine className="size-4 text-muted-foreground transition group-open:rotate-90" />
              为什么二级市场占比只有 {formatPct(totals.secondarySharePct)}？
            </span>
          </summary>
          <div className="mt-3 space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              主流代币化资产（国债、货基、私人信贷）多为许可型代币：持有者需通过发行方的身份验证与白名单，
              转账受 transfer agent 约束，进不了普通 AMM 池。这类资产的流动性体现在发行方的申购与赎回，
              而不是链上撮合。
            </p>
            <p>
              Uniswap v4 的 Permissioned Pools 标准正在改变这一点：由发行方维护白名单，
              池子在协议层校验持币资格，让许可型资产合规进入 AMM。二级占比会随该标准落地持续变化，本页会跟踪。
            </p>
          </div>
        </details>

        <details className="group mt-3 rounded-2xl border bg-card p-5">
          <summary className="cursor-pointer list-none text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2">
              <RiShieldCheckLine className="size-4 text-muted-foreground transition group-open:rotate-90" />
              许可型资产的风险因子
            </span>
          </summary>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            <li>· 发行方可以暂停交易，并可平仓（unwind）流动性头寸——普通 DeFi 池没有这个开关。</li>
            <li>· 流动性凭证通常不可转让，白名单校验无法通过转手绕过。</li>
            <li>· 二级市场深度可能极小，大额交易滑点显著；二级占比越低，这一风险越突出。</li>
            <li>· 赎回窗口、赎回费率与合格投资者要求由发行方单方面设定，可能变更。</li>
          </ul>
        </details>
      </section>

      <MockNotice>
        真实数据：DefiLlama（TVL、DEX 池）· CoinGecko（股票 / ETF / 大宗行情）。推断项：资产类别、发行方与标的名由名称解析；二级池按符号匹配可能遗漏。
      </MockNotice>

      <p className="text-xs leading-5 text-muted-foreground">
        数据源：DefiLlama（缓存 1 小时）· CoinGecko（缓存 10 分钟）· 公开接口 GET /api/v1/rwa/assets ·
        GET /api/v1/rwa/markets。本页仅聚合公开数据并提供外链跳转，不提供交易撮合、不托管资产、不代客下单、
        不构成投资建议；行情代币追踪标的价格，但并非股票或商品本身。部分国家或地区暂不提供服务（见「访问受限」页）。
      </p>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof RiBankLine
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <div className="mt-3 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  )
}
