import { kspFetch } from "./client.js";
import type { KspSearchResult, KspItemResult } from "../types/ksp.js";

/**
 * Fetch a category/search page. Two modes:
 *  - `filters` set -> browse the faceted category path `/category/<id>..<id>`
 *  - otherwise      -> free-text `/category/?search=<query>`
 * `page` (12/page) and a `query` refinement can be combined with either.
 */
export async function fetchCategory(opts: {
  query?: string;
  filters?: string;
  page?: number;
}): Promise<KspSearchResult> {
  const { query, filters, page } = opts;
  const params = new URLSearchParams();
  if (page && page > 1) params.set("page", String(page));

  let path: string;
  if (filters) {
    // Tag-id path — do NOT encode the `..` separators.
    path = `/category/${filters}`;
    if (query) params.set("search", query);
  } else {
    path = `/category/`;
    params.set("search", query ?? "");
  }

  const qs = params.toString();
  const json = await kspFetch<{ result: KspSearchResult }>(
    `${path}${qs ? `?${qs}` : ""}`,
  );
  return json.result ?? {};
}

/** Full detail for a single product by UIN. */
export async function getItem(uin: string): Promise<KspItemResult> {
  const json = await kspFetch<{ result: KspItemResult }>(
    `/item/${encodeURIComponent(uin)}`,
  );
  return json.result ?? {};
}
