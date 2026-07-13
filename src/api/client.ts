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

/** GET a KSP m_action API path and parse the JSON. The single fetch choke point. */
export async function kspFetch<T = unknown>(path: string): Promise<T> {
  const url = `${KSP_API}${path}`;
  log(`GET ${path}`);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to reach KSP (${msg}). Check your connection.`);
  }

  if (!res.ok) {
    if (res.status === 403 || res.status === 429) {
      throw new Error(
        `KSP blocked the request (HTTP ${res.status}) — likely rate-limited or bot-detected. Try again shortly.`,
      );
    }
    if (res.status === 404) {
      throw new Error(`KSP resource not found (HTTP 404): ${path}`);
    }
    throw new Error(`KSP API error ${res.status} for ${path}`);
  }

  const text = await res.text();
  // Cloudflare challenge / any HTML page comes back starting with '<' — detect
  // without parsing so we return a clear message instead of a JSON crash.
  if (text.trimStart().startsWith("<")) {
    throw new Error(
      `KSP returned an HTML page instead of JSON for ${path} (likely a Cloudflare challenge). Try again shortly.`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`KSP returned invalid JSON for ${path}`);
  }
}
