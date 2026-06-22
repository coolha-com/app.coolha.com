const DEFAULT_HARD_DENYLIST = [
  // OFAC / 制裁 / FATF Black
  "IR",
  "KP",
  "MM",
  "CU",
  "RU",
  "BY",
  "SY",

  // 明令禁止
  "CN",
] as const;

const DEFAULT_SOFT_GATELIST = [
  "HK",
  "SG",
  "GB",
  "US",
  "CA",
  "JP",
  "AU",
  "FR",
  "DE",
  "IT",
  "ES",
  "NL",
  "PL",
  "SE",
  "IE",
  "AT",
  "BE",
  "PT",
  "DK",
  "FIN",
  "GR",
  "LU",
  "CY",
  "MT",
  "EE",
  "LV",
  "LT",
  "SK",
  "SI",
  "HR",
  "RO",
  "BG",
  "CZ",
  "HU",
] as const;

export type GeoAccessTier = "allow" | "soft-gate" | "hard-block";

export type GeoAccessPolicy = {
  country: string | null;
  tier: GeoAccessTier;
  matchedList: "hard" | "soft" | "none";
};

function normalizeCountryCode(value: string | null | undefined) {
  if (!value) return null;

  const normalized = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

function toCountrySet(values: readonly string[]) {
  return new Set(
    values
      .map((value) => normalizeCountryCode(value))
      .filter((value): value is string => Boolean(value)),
  );
}

export function parseCountryList(
  value: string | undefined,
  fallback: readonly string[] = [],
) {
  const items = value
    ?.split(",")
    .map((item) => normalizeCountryCode(item))
    .filter((item): item is string => Boolean(item));

  return new Set(items?.length ? items : fallback);
}

export function getHardBlockedCountries() {
  return parseCountryList(
    process.env.GEO_HARD_BLOCKED_COUNTRIES ?? process.env.GEO_BLOCKED_COUNTRIES,
    DEFAULT_HARD_DENYLIST,
  );
}

export function getSoftGatedCountries() {
  return parseCountryList(
    process.env.GEO_SOFT_GATED_COUNTRIES,
    DEFAULT_SOFT_GATELIST,
  );
}

export function getBlockedCountries() {
  return getHardBlockedCountries();
}

export function getRequestCountry(
  headers: Headers,
  searchParams?: URLSearchParams,
) {
  const devOverride =
    process.env.NODE_ENV !== "production"
      ? normalizeCountryCode(searchParams?.get("__geoCountry"))
      : null;

  if (devOverride) {
    return devOverride;
  }

  const candidates = [
    headers.get("x-vercel-ip-country"),
    headers.get("cf-ipcountry"),
    headers.get("x-country-code"),
    headers.get("x-geo-country"),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCountryCode(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function isBlockedCountry(
  country: string | null,
  blocked = getHardBlockedCountries(),
) {
  if (!country) return false;
  return blocked.has(country);
}

export function isSoftGatedCountry(
  country: string | null,
  gated = getSoftGatedCountries(),
) {
  if (!country) return false;
  return gated.has(country);
}

export function getCountryAccessPolicy(
  country: string | null,
  options?: {
    hardBlockedCountries?: Set<string>;
    softGatedCountries?: Set<string>;
  },
): GeoAccessPolicy {
  const hardBlockedCountries =
    options?.hardBlockedCountries ?? getHardBlockedCountries();
  const softGatedCountries =
    options?.softGatedCountries ?? getSoftGatedCountries();

  if (!country) {
    return {
      country,
      tier: "allow",
      matchedList: "none",
    };
  }

  if (hardBlockedCountries.has(country)) {
    return {
      country,
      tier: "hard-block",
      matchedList: "hard",
    };
  }

  if (softGatedCountries.has(country)) {
    return {
      country,
      tier: "soft-gate",
      matchedList: "soft",
    };
  }

  return {
    country,
    tier: "allow",
    matchedList: "none",
  };
}

export const HARD_DENYLIST = toCountrySet(DEFAULT_HARD_DENYLIST);
export const SOFT_GATELIST = toCountrySet(DEFAULT_SOFT_GATELIST);
