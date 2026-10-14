import { PROVIDER_LOGO_PATHS } from "./provider-logos.generated"

/**
 * 供应商 / 模型 Logo 解析。
 *
 * Logo 源文件由 scripts/fetch-provider-logos.mjs 抓取到 public/logos/providers/，
 * 优先 Vercel AI Gateway 官方展示图，缺失时回退 models.dev。
 * 未收录的供应商返回 null，UI 侧渲染首字母标识块。
 */

export interface ProviderLogo {
  /** 本地静态资源路径；null 表示无官方 Logo */
  src: string | null
  /** 无 Logo 时展示的兜底字母（取供应商名首字符） */
  fallback: string
}

export function getProviderLogo(providerId: string, providerName?: string): ProviderLogo {
  const src = PROVIDER_LOGO_PATHS[providerId] ?? null
  const fallback = (providerName ?? providerId).replace(/[^A-Za-z0-9\u4e00-\u9fa5]/g, "").slice(0, 2)
  return { src, fallback: fallback.length > 0 ? fallback.toUpperCase() : "?" }
}

/**
 * 模型 Logo：AI Gateway 不提供逐模型图标，
 * 沿用供应商标识（与 vercel.com/ai-gateway/models 的展示一致）。
 */
export function getModelLogo(providerId: string, providerName?: string): ProviderLogo {
  return getProviderLogo(providerId, providerName)
}

/** 该供应商是否有官方 Logo（用于决定是否渲染图片） */
export function hasProviderLogo(providerId: string): boolean {
  return Boolean(PROVIDER_LOGO_PATHS[providerId])
}
