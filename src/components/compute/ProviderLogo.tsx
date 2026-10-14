"use client"

import { useState } from "react"
import { getProviderLogo } from "@/lib/ai-gateway/logos"
import { cn } from "@/lib/utils"

/**
 * 供应商 Logo：加载失败或无官方 Logo 时回退到首字标识块。
 * 使用原生 img 而非 next/image——Logo 尺寸固定（≤64px）且数量有限，
 * 走静态资源即可，避免为几十个小图引入优化器开销。
 */
export function ProviderLogo({
  providerId,
  providerName,
  size = 20,
  className,
}: {
  providerId: string
  providerName: string
  size?: number
  className?: string
}) {
  const { src, fallback } = getProviderLogo(providerId, providerName)
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size, fontSize: Math.max(8, size * 0.42) }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md bg-muted font-bold text-muted-foreground",
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
      className={cn("shrink-0 rounded-md object-contain", className)}
    />
  )
}
