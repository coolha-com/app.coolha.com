import type { Metadata } from "next"
import Link from "next/link"
import {
  RiArrowRightLine,
  RiBankCardLine,
  RiCpuLine,
  RiKey2Line,
  RiLineChartLine,
  RiTerminalBoxLine,
} from "react-icons/ri"
import type { IconType } from "react-icons"
import { MockNotice } from "@/components/compute/MockBadge"
import { CopyButton } from "@/components/compute/CopyButton"
import { getModelCatalog } from "@/lib/ai-gateway/client"

export const metadata: Metadata = {
  title: "算力市场",
  description: "聚合 AI 模型 API 与推理服务的交易市场",
}

/** 与模型目录同源的 1 小时缓存 */
export const revalidate = 3600

const ENTRIES: Array<{
  title: string
  description: string
  href: string
  icon: IconType
  status: string
}> = [
  {
    title: "模型广场",
    description: "搜索、筛选并比较模型的类型、能力、上下文与价格。",
    href: "/ai/models",
    icon: RiCpuLine,
    status: "真实目录",
  },
  {
    title: "Playground",
    description: "直接向 AI Gateway 发起真实推理，查看流式输出、推理过程与真实成本。",
    href: "/ai/playground",
    icon: RiTerminalBoxLine,
    status: "真实调用",
  },
  {
    title: "API Keys",
    description: "创建、撤销 Coolha API Key，配置名称、模型权限与消费限额。",
    href: "/ai/api-keys",
    icon: RiKey2Line,
    status: "Phase 2",
  },
  {
    title: "用量记录",
    description: "查询每次真实调用的模型、Token 用量、耗时与成本明细。",
    href: "/ai/usage",
    icon: RiLineChartLine,
    status: "真实数据",
  },
  {
    title: "余额与账单",
    description: "查看余额、账本流水与充值订单，支持稳定币支付。",
    href: "/ai/billing",
    icon: RiBankCardLine,
    status: "Phase 3-4",
  },
]

const QUICKSTART = `# 1) 列出全部模型（公开只读接口，无需鉴权）
curl "https://app.coolha.com/api/v1/models?type=chat&sort=price-asc&limit=20"

# 2) 按关键词 / 供应商 / 能力筛选
curl "https://app.coolha.com/api/v1/models?q=claude&provider=anthropic"
curl "https://app.coolha.com/api/v1/models?capability=vision&maxPrice=1"

# 3) 查看单个模型（slug = 模型 ID 中的 / 替换为 -）
curl "https://app.coolha.com/api/v1/models/anthropic-claude-sonnet-4-5"`

export default async function ComputeMarketPage() {
  const catalog = await getModelCatalog()
  const isLive = catalog.source === "ai-gateway"

  return (
    <div className="mt-8 space-y-8">
      <section className="rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
        <h2 className="text-xl font-semibold">在这里发现、比较并调用 AI 模型</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          第一版聚焦验证供需与交易闭环：模型聚合、统一 API、价格比较、在线测试与用量统计。
          不自建 GPU 集群、不训练模型、不发行代币。所有调用均经过服务端网关，浏览器不接触上游密钥。
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-3 py-1">
            当前目录：{catalog.models.length} 个模型 ·{" "}
            {isLive ? "Vercel AI Gateway 实时同步" : "演示数据（上游不可用）"}
          </span>
          <span className="rounded-full bg-muted px-3 py-1">
            目录接口：GET /api/v1/models
          </span>
          <span className="rounded-full bg-muted px-3 py-1">支付：稳定币结算（Phase 4）</span>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">模块入口</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ENTRIES.map(({ title, description, href, icon: Icon, status }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:border-primary/60"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Icon className="size-5" />
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  {status}
                </span>
              </div>
              <h3 className="mt-4 flex items-center gap-1 font-semibold">
                {title}
                <RiArrowRightLine className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">快速开始 · 模型目录接口</h2>
          <CopyButton text={QUICKSTART} label="复制示例" />
        </div>
        <ol className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
          <li>1. 在模型广场按类型、价格与能力筛选，进入详情页查看计费规则。</li>
          <li>2. 用下方公开接口把目录接进你自己的应用（默认缓存 1 小时，可按条件筛选）。</li>
          <li>3. 到 Playground 用默认免费模型发起真实推理，用量与成本会写入 /ai/usage。</li>
        </ol>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-muted p-4 text-xs leading-5">
          <code>{QUICKSTART}</code>
        </pre>
      </section>

      <MockNotice>
        已接入真实数据：模型目录与价格（Vercel AI Gateway）、Playground 真实推理、用量记录。
        仍未开放：API Key 与统一网关、计费账本（Phase 3）与稳定币充值（Phase
        4）——这些模块当前展示的均为示例数据。
      </MockNotice>

      <p className="text-xs leading-5 text-muted-foreground">
        合规说明：根据适用的法律、监管和合规要求，部分国家或地区暂不提供访问或相关服务
        （见「访问受限」页）。调用日志默认不保存完整提示词与模型回复，仅记录计费与排错所需元数据。
      </p>
    </div>
  )
}
