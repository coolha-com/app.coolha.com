"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

/**
 * 图标：加载失败或缺失时回退到首字标识块。
 * 使用原生 img 而非 next/image——图标尺寸固定且数量有限，
 * 走静态资源即可，避免为上百个小图引入优化器开销。
 *
 * 外部图标来自 DefiLlama icons（icons.llamao.fi），与 ProviderLogo 同样的处理方式。
 */
function Logo({
  src,
  name,
  size = 20,
  rounded = "rounded-md",
  className,
}: {
  src: string | null
  name: string
  size?: number
  rounded?: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const fallback = (name || "?").trim().charAt(0).toUpperCase()

  if (!src || failed) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size, fontSize: Math.max(8, size * 0.42) }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center bg-muted font-bold text-muted-foreground",
          rounded,
          className,
        )}
      >
        {fallback}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className={cn("shrink-0 bg-muted object-contain", rounded, className)}
    />
  )
}

/** 资产 / 发行方图标 */
export function RwaLogo({
  src,
  name,
  size = 24,
  className,
}: {
  src: string | null
  name: string
  size?: number
  className?: string
}) {
  return <Logo src={src} name={name} size={size} className={className} />
}

/** 链图标组（重叠排列，最多显示前 3 个） */
export function ChainLogos({
  chains,
  logos,
  size = 16,
  max = 3,
}: {
  chains: string[]
  logos: (string | null)[]
  size?: number
  max?: number
}) {
  const shown = chains.slice(0, max)
  return (
    <span className="inline-flex items-center">
      {shown.map((chain, index) => (
        <span
          key={`${chain}-${index}`}
          title={chain}
          style={{ marginLeft: index === 0 ? 0 : -size * 0.35, zIndex: shown.length - index }}
          className="relative rounded-full ring-1 ring-background"
        >
          <Logo src={logos[index] ?? null} name={chain} size={size} rounded="rounded-full" />
        </span>
      ))}
      {chains.length > shown.length ? (
        <span className="ml-1 text-xs text-muted-foreground">+{chains.length - shown.length}</span>
      ) : null}
    </span>
  )
}
