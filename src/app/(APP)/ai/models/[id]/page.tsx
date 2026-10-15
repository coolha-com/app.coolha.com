import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { RiArrowLeftLine } from "react-icons/ri"
import { CostEstimator } from "@/components/compute/CostEstimator"
import { CapabilityBadges } from "@/components/compute/CapabilityBadges"
import { CopyButton } from "@/components/compute/CopyButton"
import { ProviderLogo } from "@/components/compute/ProviderLogo"
import { modelCapabilityTags } from "@/components/compute/capability-meta"
import { DataSourceBadge } from "@/components/compute/DataSourceBadge"
import { MockNotice } from "@/components/compute/MockNotice"
import { CollapsibleNote } from "@/components/compute/CollapsibleNote"
import { StatusBadge } from "@/components/compute/StatusBadge"
import { AI_GATEWAY_BASE_URL, getCatalogModelBySlug } from "@/lib/ai-gateway/client"
import {
  DATA_SOURCE_NOTICE,
  MODEL_TYPE_LABELS,
  formatLatency,
  formatPricePerMillion,
  formatTokens,
} from "@/lib/compute/service"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const model = await getCatalogModelBySlug(id)
  return {
    title: model ? `${model.name} · 模型详情` : "模型不存在",
    description: model?.summary,
  }
}

export default async function ModelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const model = await getCatalogModelBySlug(id)
  if (!model) notFound()

  const isLive = model.dataSource !== "mock"

  // 合规：本页只做目录展示，示例指向上游官方端点，不提供 token 中转/转售
  const apiExample = `curl ${AI_GATEWAY_BASE_URL}/chat/completions \\
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model.modelId}",
    "messages": [
      {"role": "user", "content": "Hello"}
    ],
    "stream": false
  }'`

  return (
    <section className="m-6 space-y-4">
      <Link
        href="/ai/models"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <RiArrowLeftLine className="size-4" />
        返回模型广场
      </Link>

      {isLive ? null : (
        <MockNotice>
          该条目来自 Phase 1 演示目录：价格、延迟、状态均为示例数据，不代表真实供应商报价。
        </MockNotice>
      )}

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <ProviderLogo
              providerId={model.providerId}
              providerName={model.providerName}
              size={48}
              className="rounded-xl"
            />
            <div>
              <h2 className="text-2xl font-semibold">{model.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {model.providerName} · {MODEL_TYPE_LABELS[model.type]} ·{" "}
                <code className="font-mono">{model.modelId}</code>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={model.status} />
            <DataSourceBadge source={model.dataSource} />
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Spec label="输入价格" value={formatPricePerMillion(model.inputPricePerMillionUsd)} />
          <Spec label="输出价格" value={formatPricePerMillion(model.outputPricePerMillionUsd)} />
          {model.cachedInputPricePerMillionUsd ? (
            <Spec
              label="缓存命中输入价格"
              value={formatPricePerMillion(model.cachedInputPricePerMillionUsd)}
            />
          ) : null}
          <Spec
            label="上下文长度"
            value={model.contextLength > 0 ? formatTokens(model.contextLength) : "—"}
          />
          <Spec
            label="最大输出"
            value={model.maxOutputTokens > 0 ? formatTokens(model.maxOutputTokens) : "—"}
          />
          <Spec label="延迟" value={formatLatency(model.latencyMs)} />
          <Spec label="知识截止" value={model.knowledge ?? "未公布"} />
          <Spec label="发布时间" value={model.releasedAt ?? "—"} />
          <Spec label="零数据保留" value={ZDR_LABELS[model.zeroDataRetention ?? ""] ?? "未公布"} />
          <Spec label="不用于训练" value={ZDR_LABELS[model.noTraining ?? ""] ?? "未公布"} />
          <Spec
            label="可用区域"
            value={model.regions && model.regions.length > 0 ? model.regions.join(" / ").toUpperCase() : "未限定"}
          />
          <Spec label="数据来源" value={DATA_SOURCE_NOTICE[model.dataSource]} />
          <Spec label="更新时间" value={model.updatedAt} />
          <Spec label="网关模型 ID" value={model.gatewayModelId ?? "—"} />
        </dl>

        <div className="mt-5">
          <CapabilityBadges tags={modelCapabilityTags(model)} max={12} />
        </div>

        {model.tags && model.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {model.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <CostEstimator model={model} />

        <div className="space-y-4">
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">API 调用示例</h2>
              <CopyButton text={apiExample} />
            </div>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-muted p-4 text-xs leading-5">
              <code>{apiExample}</code>
            </pre>
          </section>

          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">在 Playground 中测试</h2>
            <Link
              href="/chat"
              className="mt-4 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              打开 Playground
            </Link>
          </section>
        </div>
      </div>

      <CollapsibleNote className="mt-4" title="本页说明">
        <p>{model.summary}</p>
        {model.priceVariesByProvider ? (
          <p>* 该模型价格随下游供应商浮动，展示值为目录基准价。</p>
        ) : null}
        <p>
          API 示例直连 Vercel AI Gateway 官方端点，需使用你自己的 AI Gateway Key。Coolha
          本页仅提供目录与价格查询，不提供 token 中转或转售服务。
        </p>
        <p>Playground 目前仍运行 Phase 1 演示模式（本地模拟回复，不产生真实调用）。</p>
      </CollapsibleNote>
    </section>
  )
}

const ZDR_LABELS: Record<string, string> = {
  all: "全部支持",
  some: "部分支持",
  none: "不支持",
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  )
}
