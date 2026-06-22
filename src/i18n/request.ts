import { getRequestConfig } from "next-intl/server"
import { cookies, headers } from "next/headers"

type SupportedLocale = "en" | "zh-Hans" | "zh-Hant"

function normalizeLocale(value: string | null | undefined): SupportedLocale {
  const locale = value?.trim().toLowerCase()

  if (!locale) {
    return "en"
  }

  if (locale === "zh-hans" || locale.startsWith("zh-cn") || locale.startsWith("zh-sg")) {
    return "zh-Hans"
  }

  if (
    locale === "zh-hant" ||
    locale.startsWith("zh-hk") ||
    locale.startsWith("zh-mo") ||
    locale.startsWith("zh-tw")
  ) {
    return "zh-Hant"
  }

  if (locale.startsWith("zh")) {
    return "zh-Hans"
  }

  return "en"
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value
  const acceptLanguage = headerStore.get("accept-language") ?? ""
  const acceptLocale = acceptLanguage.split(",")[0]?.trim()
  const locale = normalizeLocale(cookieLocale ?? acceptLocale)

  return {
    locale,
    messages: (await import(`./${locale}.json`)).default,
  }
})
