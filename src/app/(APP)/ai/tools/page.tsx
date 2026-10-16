import type { Metadata } from "next"
import {
  RiAlertLine,
  RiCheckboxLine,
  RiInformationLine,
  RiServerLine,
} from "react-icons/ri"
import { ModulePage } from "@/components/compute/ModulePage"
import { ToolsBrowser } from "@/components/compute/ToolsBrowser"
import { WEB3_TOOLS, summarizeTools } from "@/lib/web3-tools/service"

export const metadata: Metadata = {
  title: "Web3 工具",
  description:
    "Coolha 的 Web3 工具选型：接入以太坊官方收录的 MCP Server / Agent Skill / CLI，标注每一条的接入方式、优先级与风险。",
}

/** 静态目录：不含实时数据，无需回源 */
export const dynamic = "force-static"

const STATS = summarizeTools(WEB3_TOOLS)

const P0_NAMES = WEB3_TOOLS.filter((t) => t.priority === "p0").map((t) => t.name)
const REJECTED = WEB3_TOOLS.filter((t) => t.priority === "no")

/**
 * Web3 工具选型页。
 *
 * **不自研工具层**：行业已收敛出 MCP + Agent Skills 标准，直接接现成的。
 * 我们的增量投入放在治理层（模拟、风险扫描、限额、签名）与用户主权上。
 *
 * 页面因此不是「我们有什么功能」，而是「我们要接什么、怎么接、哪些明确不接」。
 * 当前全部条目 `integration: "none"` —— 一条都没接入，顶部有常驻声明。
 */
export default function ToolsPage() {
  return (
    <ModulePage
      title="Web3 工具"
      description="生态已经给出了 MCP 与 Agent Skills 两个标准，我们直接接现成的，不平行造轮子。这里列出以太坊官方收录的工具、我们的接入优先级，以及每个明确的取舍理由。"
    >
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <RiAlertLine className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium">这是选型计划，工具尚未接入</p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              本页 {STATS.total} 个工具全部来自以太坊官方 agent-tooling 目录，
              能力描述转述自各项目官方文档。
              <span className="text-foreground">Coolha 目前一个都还没接入</span>
              ，所以你在 Chat 里现在还用不到它们。
              「P0」是我们打算先动手的那批，「不接入」是评估后明确排除的。
            </p>
          </div>
        </div>
      </div>

      <ToolsBrowser tools={WEB3_TOOLS} />

      <section className="mt-8 space-y-3">
        <div className="rounded-2xl border bg-card p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <RiServerLine className="size-4 text-primary" aria-hidden />
            第一批要接的 {P0_NAMES.length} 个
          </p>
          <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
            {P0_NAMES.join(" · ")}。
            选型逻辑很简单：<span className="text-foreground">读数据的和查链的</span>先接
            （Alchemy 拿数据、DefiLlama 拿 TVL、Slither 做审计分析），
            <span className="text-foreground">签名流</span>用来定死「服务端永不持钥」这条红线的实现方式
            （request-wallet-sign 是唯一被官方收录的成熟参考实现）。
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border bg-card p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <RiCheckboxLine className="size-4 text-primary" aria-hidden />
              明确不接的 {REJECTED.length} 个
            </p>
            <ul className="mt-2 space-y-2">
              {REJECTED.map((tool) => (
                <li key={tool.id} className="text-xs leading-5 text-muted-foreground">
                  <span className="text-foreground">{tool.name}</span>
                  <span className="mx-1">·</span>
                  {tool.caveats[0]}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border bg-card p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <RiInformationLine className="size-4 text-primary" aria-hidden />
              接第三方工具的边界
            </p>
            <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
              服务端不托管第三方密钥，也不代售任何 key；写操作类工具一律先出
              <span className="text-foreground">交易草稿</span>，模拟通过后才请求你的签名。
              凡是许可不清晰或要求服务端持钥的，宁可不接 —— 生态里有 31 个可选，不需要赌。
            </p>
          </div>
        </div>
      </section>
    </ModulePage>
  )
}