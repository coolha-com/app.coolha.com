import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  getCountryAccessPolicy,
  getHardBlockedCountries,
  getRequestCountry,
  getSoftGatedCountries,
} from "./src/lib/compliance/geo";

const BLOCKED_PAGE_PATH = "/blocked";

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname === BLOCKED_PAGE_PATH) {
    return NextResponse.next();
  }

  const country = getRequestCountry(request.headers, searchParams);
  const hardBlockedCountries = getHardBlockedCountries();
  const softGatedCountries = getSoftGatedCountries();
  const policy = getCountryAccessPolicy(country, {
    hardBlockedCountries,
    softGatedCountries,
  });

  if (policy.tier === "hard-block" && pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "SERVICE_UNAVAILABLE_IN_YOUR_REGION",
        country,
        tier: policy.tier,
      },
      {
        status: 451,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (policy.tier === "hard-block") {
    const blockedUrl = request.nextUrl.clone();
    blockedUrl.pathname = BLOCKED_PAGE_PATH;
    blockedUrl.searchParams.set("country", country ?? "");
    blockedUrl.searchParams.set("from", pathname);

    return NextResponse.redirect(blockedUrl, 307);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-coolha-geo-country", country ?? "");
  requestHeaders.set("x-coolha-geo-access-tier", policy.tier);
  requestHeaders.set("x-coolha-geo-match", policy.matchedList);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("x-coolha-geo-country", country ?? "");
  response.headers.set("x-coolha-geo-access-tier", policy.tier);
  response.headers.set("x-coolha-geo-match", policy.matchedList);

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-icon.png|shortcut-icon.png|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
