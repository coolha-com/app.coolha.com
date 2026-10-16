import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { RiArrowLeftLine, RiChatSmileAiLine, RiKey2Line, RiLockLine } from "react-icons/ri"
import { CapabilityBadges } from "@/components/compute/CapabilityBadges"
import { ProviderLogo } from "@/components/compute/ProviderLogo"
import { modelCapabilityTags } from "@/components/compute/capability-meta"
import { DataSourceBadge } from "@/components/compute/DataSourceBadge"
import { MockNotice } from "@/components/compute/MockNotice"
import { CollapsibleNote } from "@/components/compute/CollapsibleNote"
import { StatusBadge } from "@/components/compute/StatusBadge"
import { CostEstimator } from "@/components/compute/CostEstimator"
import { getCatalogModelBySlug } from "@/lib/ai-gateway/client"
import { isSponsorableModel } from "@/lib/ai-gateway/shared"
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
  /** 是否在 Coolha 赞助范围：判据是数据政策（零数据保留 + 不训练 + 非 stealth），不是价格 */
  const sponsored = isSponsorableModel(model)

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
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={model.status} />
            <span
              className={
                isSponsorableModel(model)
                  ? "inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                  : "inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
              }
            >
              {isSponsorableModel(model) ? null : <RiLockLine className="size-3" />}
              {isSponsorableModel(model) ? "零数据保留 · 不训练" : "不在赞助范围"}
            </span>
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
        {/* 使用方式：赞助模型直接进 Chat；其余走自己的 Key */}
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">怎么在 Chat 里用</h2>

          {sponsored ? (
            <>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                该模型由 Coolha 赞助推理费用，且供应商承诺
                <strong className="font-medium text-foreground">零数据保留、不用于训练</strong>
                ，可直接在 Chat 中对话。需要签名登录，用量计入每日统一额度
                （所有登录用户相同，与是否订阅无关）。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/chat?model=${encodeURIComponent(model.id)}`}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  <RiChatSmileAiLine className="size-4" />
                  在 Chat 中对话
                </Link>
                <Link
                  href="/ai/usage"
                  className="inline-flex h-10 items-center rounded-xl border px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  查看我的用量
                </Link>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                超出每日额度后，接入你自己的模型服务即可继续使用——升级订阅不会增加免费额度，
                订阅解锁的是云端历史、同步、检索与导出等软件能力。
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                该模型不满足 Coolha 的赞助标准（需同时满足零数据保留、不用于训练、非预发布测试模型）。
                要使用它，请在「API 连接」中添加你自己的模型服务——密钥只保存在你的浏览器，Chat
                会直连调用，推理费用由你自己承担。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/ai/api-keys"
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
                >
                  <RiKey2Line className="size-4" />
                  配置自定义模型
                </Link>
                <Link
                  href="/chat"
                  className="inline-flex h-10 items-center rounded-xl border px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  去 Chat
                </Link>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                订阅解锁的是 Coolha 的软件能力（云端历史、跨设备同步、检索、导出），不包含第三方模型的推理额度。
              </p>
            </>
          )}
        </section>

        {/* 费用估算：从「API 成本」改述为「用你自己 Key 时的成本参考」 */}
        <CostEstimator model={model} />
      </div>

      <CollapsibleNote className="mt-4" title="本页说明">
        <p>{model.summary}</p>
        {model.priceVariesByProvider ? (
          <p>* 该模型价格随下游供应商浮动，展示值为目录基准价。</p>
        ) : null}
        <p>
          模型广场是目录与价格查询。免费模型的推理由 Coolha
          赞助并计入你的每日配额；其他模型请接入你自己的服务使用。Coolha
          不提供 token 中转或转售服务。
        </p>
        <p>
          上方的费用估算用于评估「用你自己的 Key 调用该模型」的成本，不代表 Coolha 的收费。
        </p>
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
