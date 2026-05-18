import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const headerStore = headers();
  const cookieLocale = (await cookieStore).get("NEXT_LOCALE")?.value;
  const acceptLang = (await headerStore).get("accept-language") ?? "";
  const acceptLocale = acceptLang.split(",")[0]?.trim();
  const normalizedAccept =
    acceptLocale?.toLowerCase().startsWith("en") ? "en" : "en";
  const locale = cookieLocale || normalizedAccept || "en";

  return {
    locale,
    messages: (await import(`./${locale}.json`)).default,
  };
});
