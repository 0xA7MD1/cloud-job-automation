import { discardBody } from "@/lib/http";
import { isAggregatorDomain, normalizeDomain } from "./domain";

// شركات قريبة من خرائط Google (Places API New، Text Search) بمفتاح المستخدم.
// شروط Google: ما نحفظ من النتيجة إلا place_id. رابط الموقع نستخدمه بس عشان نزور موقع الشركة،
// والاسم والنطاق والوظائف نجمعها من موقعهم نفسه.

export interface PlaceHit {
  placeId: string;
  /** نطاق موقع الشركة (مؤقت، ما ينحفظ كبيانات Google) */
  domain: string;
}

export class PlacesError extends Error {
  constructor(readonly status: number | null) {
    super(`places search failed${status ? ` (${status})` : ""}`);
  }
}

// روابط مو مواقع شركات (صفحات تواصل، روابط مختصرة، منصات صفحات)
const NOT_COMPANY_SITES = /(^|\.)(linktr\.ee|wa\.me|t\.me|snapchat\.com|business\.site|bit\.ly|maps\.app\.goo\.gl|goo\.gl|calendly\.com|beacons\.ai)$/i;

/**
 * يبحث عن أماكن ويرجّع الي لها موقع رسمي. طلب واحد = حتى 20 مكان (فئة Enterprise عند Google:
 * 1000 طلب مجاني شهريًا لكل حساب).
 */
export async function searchPlaces(
  apiKey: string,
  input: { query: string; area: string; limit: number },
): Promise<{ hits: PlaceHit[]; withoutWebsite: number }> {
  let response: Response;
  try {
    response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.websiteUri",
      },
      body: JSON.stringify({
        textQuery: `${input.query.trim()} in ${input.area.trim()}`,
        pageSize: Math.min(20, Math.max(1, input.limit)),
        languageCode: "en",
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new PlacesError(null);
  }
  if (!response.ok) {
    discardBody(response);
    throw new PlacesError(response.status);
  }
  let body: { places?: { id?: unknown; websiteUri?: unknown }[] };
  try {
    body = await response.json();
  } catch {
    throw new PlacesError(null);
  }

  const seen = new Set<string>();
  const hits: PlaceHit[] = [];
  let withoutWebsite = 0;
  for (const place of body.places ?? []) {
    if (typeof place.id !== "string") continue;
    const domain = typeof place.websiteUri === "string" ? normalizeDomain(place.websiteUri) : null;
    if (!domain || isAggregatorDomain(domain) || NOT_COMPANY_SITES.test(domain)) {
      withoutWebsite++;
      continue;
    }
    if (seen.has(domain)) continue;
    seen.add(domain);
    hits.push({ placeId: place.id, domain });
  }
  return { hits, withoutWebsite };
}
