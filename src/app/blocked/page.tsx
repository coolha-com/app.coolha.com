import Link from "next/link"
import { getTranslations } from "next-intl/server"

export async function generateMetadata() {
  const t = await getTranslations("blocked")

  return {
    title: t("title"),
    robots: {
      index: false,
      follow: false,
    },
  }
}

type BlockedPageProps = {
  searchParams: Promise<{
    country?: string
    from?: string
  }>
}

export default async function BlockedPage({
  searchParams,
}: BlockedPageProps) {
  const t = await getTranslations("blocked")
  const { country } = await searchParams

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="space-y-4">
          <p className="text-sm font-medium text-muted-foreground">
            {t("eyebrow")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
          {country ? (
            <p className="text-sm text-muted-foreground">
              {t("detected_country", { country })}
            </p>
          ) : null}
        </div>



        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="https://coolha.com"
            className="inline-flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            {t("back_official")}
          </Link>

          <Link
            href="mailto:help@coolha.com"
            className="inline-flex h-10 items-center justify-center rounded-full border border-black bg-white px-5 text-sm font-medium text-black transition-opacity hover:opacity-90"
          >
            {t("contact_support")}
          </Link>
        </div>
      </div>
    </main>
  )
}
