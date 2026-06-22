import { NextResponse } from "next/server";

import {
  getCountryAccessPolicy,
  getHardBlockedCountries,
  getRequestCountry,
  getSoftGatedCountries,
} from "@/lib/compliance/geo";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const country = getRequestCountry(request.headers, url.searchParams);
  const hardBlockedCountries = getHardBlockedCountries();
  const softGatedCountries = getSoftGatedCountries();
  const policy = getCountryAccessPolicy(country, {
    hardBlockedCountries,
    softGatedCountries,
  });

  return NextResponse.json(
    {
      ok: true,
      environment: process.env.NODE_ENV,
      country,
      accessTier: policy.tier,
      matchedList: policy.matchedList,
      fromDebugOverride:
        process.env.NODE_ENV !== "production"
          ? Boolean(url.searchParams.get("__geoCountry"))
          : false,
      requestHeaders: {
        host: request.headers.get("host"),
        "x-forwarded-for": request.headers.get("x-forwarded-for"),
        "x-real-ip": request.headers.get("x-real-ip"),
        "x-vercel-id": request.headers.get("x-vercel-id"),
        "x-vercel-ip-country": request.headers.get("x-vercel-ip-country"),
        "x-vercel-ip-country-region": request.headers.get(
          "x-vercel-ip-country-region",
        ),
        "x-vercel-ip-city": request.headers.get("x-vercel-ip-city"),
        "x-vercel-ip-continent": request.headers.get("x-vercel-ip-continent"),
        "cf-ipcountry": request.headers.get("cf-ipcountry"),
      },
      lists: {
        hardBlockedCountries: Array.from(hardBlockedCountries),
        softGatedCountries: Array.from(softGatedCountries),
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
