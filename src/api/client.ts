import { log } from "../log.js";

const KSP_API = "https://ksp.co.il/m_action/api";
export const KSP_WEB = "https://ksp.co.il/web";

// A realistic desktop-Chrome header set. KSP sits behind Cloudflare, whose
// bot check keys on a plausible browser User-Agent (+ Accept-Language/Referer).
// With these headers a plain fetch returns clean JSON; a stub UA gets the
// "Just a moment…" challenge instead. No cookies or browser automation needed.
const HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
  Referer: `${KSP_WEB}/`,
};

const TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3; // retries after the first attempt
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 8_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Exponential backoff with jitter; honors a Retry-After hint (seconds). */
function backoffDelay(attempt: number, retryAfterSec?: number): number {
  if (retryAfterSec && retryAfterSec > 0) {
    return Math.min(retryAfterSec * 1000, 30_000);
  }
  const exp = BASE_DELAY_MS * 2 ** attempt;
  return Math.min(exp + Math.random() * BASE_DELAY_MS, MAX_DELAY_MS);
}

/**
 * GET a KSP m_action API path and parse the JSON. The single fetch choke point
 * for every tool — so retry/backoff on rate-limits and transient failures
 * lives here once and covers all calls (search, filters, item, all-pages).
 */
export async function kspFetch<T = unknown>(path: string): Promise<T> {
  const url = `${KSP_API}${path}`;
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) log(`retry ${attempt}/${MAX_RETRIES} ${path}`);
    else log(`GET ${path}`);

    // --- network / timeout (retryable) ---
    let res: Response;
    try {
      res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastErr = new Error(`Failed to reach KSP (${msg}).`);
      if (attempt < MAX_RETRIES) {
        await sleep(backoffDelay(attempt));
        continue;
      }
      throw lastErr;
    }

    // --- rate-limit / temporary unavailability (retryable) ---
    if ([429, 502, 503, 504].includes(res.status)) {
      const retryAfter = Number(res.headers.get("retry-after"));
      lastErr = new Error(
        `KSP ${res.status} (rate-limited or temporarily unavailable) for ${path}.`,
      );
      if (attempt < MAX_RETRIES) {
        await sleep(backoffDelay(attempt, retryAfter));
        continue;
      }
      throw lastErr;
    }

    // --- hard failures (not retryable) ---
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error(`KSP blocked the request (HTTP 403 — bot check) for ${path}.`);
      }
      if (res.status === 404) {
        throw new Error(`KSP resource not found (HTTP 404): ${path}`);
      }
      throw new Error(`KSP API error ${res.status} for ${path}`);
    }

    const text = await res.text();

    // Cloudflare challenge / any HTML page starts with '<' — treat as transient.
    if (text.trimStart().startsWith("<")) {
      lastErr = new Error(
        `KSP returned an HTML page instead of JSON for ${path} (likely a Cloudflare challenge).`,
      );
      if (attempt < MAX_RETRIES) {
        await sleep(backoffDelay(attempt));
        continue;
      }
      throw lastErr;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`KSP returned invalid JSON for ${path}`);
    }
  }

  throw lastErr ?? new Error(`KSP request failed: ${path}`);
}
