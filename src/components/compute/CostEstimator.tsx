"use client"

import { useMemo, useState } from "react"
import type { ComputeModel } from "@/lib/compute/types"
import { estimateCost, formatPricePerMillion, formatTokens, formatUsd } from "@/lib/compute/service"
import { DataSourceBadge } from "./DataSourceBadge"

/** API 成本估算器：与 PRD 4.2 示例一致（输入/输出 Token 数可调） */
export function CostEstimator({ model }: { model: ComputeModel }) {
  // 上游未公布上下文窗口时回退到 1M 上限，避免滑块区间为 0
  const inputMax = model.contextLength > 0 ? Math.min(model.contextLength, 1_000_000) : 1_000_000
  const outputMax = model.maxOutputTokens > 0 ? Math.min(model.maxOutputTokens, 200_000) : 0
  const [inputTokens, setInputTokens] = useState(10_000)
  const [outputTokens, setOutputTokens] = useState(2_000)

  const estimate = useMemo(
    () => estimateCost(model, inputTokens, outputTokens),
    [model, inputTokens, outputTokens],
  )

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">API 成本估算器</h2>
        <DataSourceBadge source={model.dataSource} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {model.dataSource === "mock"
          ? "以下为可调节的示例价格，非真实报价。价格单位为 USD / 百万 Token。"
          : "按上游目录单价线性估算，未计入缓存折扣、批处理折扣、图片/工具调用等附加计费项。价格单位为 USD / 百万 Token。"}
      </p>

      <div className="mt-5 space-y-5">
        <div>
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="estimator-input-tokens">输入 Token 数</label>
            <span className="font-medium tabular-nums">
              {estimate.inputTokens.toLocaleString("en-US")}
            </span>
          </div>
          <input
            id="estimator-input-tokens"
            type="range"
            min={0}
            max={inputMax}
            step={1000}
            value={inputTokens}
            onChange={(event) => setInputTokens(Number(event.target.value))}
            className="mt-2 w-full accent-[var(--primary)]"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            0 – {formatTokens(inputMax)}
            {model.contextLength > 0 ? `（上下文窗口 ${formatTokens(model.contextLength)}）` : ""}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="estimator-output-tokens">输出 Token 数</label>
            <span className="font-medium tabular-nums">
              {estimate.outputTokens.toLocaleString("en-US")}
            </span>
          </div>
          <input
            id="estimator-output-tokens"
            type="range"
            min={0}
            max={outputMax}
            step={100}
            value={outputTokens}
            disabled={outputMax === 0}
            onChange={(event) => setOutputTokens(Number(event.target.value))}
            className="mt-2 w-full accent-[var(--primary)] disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {outputMax === 0
              ? "该模型不适用输出计费"
              : `0 – ${formatTokens(outputMax)}（最大输出 ${formatTokens(model.maxOutputTokens)}）`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-muted px-3 py-2">
            <p className="text-xs text-muted-foreground">输入价格（$/百万 Token）</p>
            <p className="mt-0.5 font-medium tabular-nums">
              {formatPricePerMillion(model.inputPricePerMillionUsd)}
            </p>
          </div>
          <div className="rounded-xl bg-muted px-3 py-2">
            <p className="text-xs text-muted-foreground">输出价格（$/百万 Token）</p>
            <p className="mt-0.5 font-medium tabular-nums">
              {formatPricePerMillion(model.outputPricePerMillionUsd)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-xs text-muted-foreground">预计调用成本</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">
            {formatUsd(estimate.totalCostUsd)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            输入 {formatUsd(estimate.inputCostUsd)} + 输出 {formatUsd(estimate.outputCostUsd)}
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          计算公式：输入 Token × 输入单价 + 输出 Token × 输出单价。实际费用还可能包含图片、缓存、工具调用等计费项。
        </p>
      </div>
    </section>
  )
}
