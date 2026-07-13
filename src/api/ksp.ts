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

/** Safety bound so a broad query can't spawn hundreds of sequential requests. */
export const MAX_ALL_PAGES = 50;

/**
 * Fetch every page of a category/search (12/page) until KSP reports no `next`
 * or MAX_ALL_PAGES is hit. `minMax`/`total` are taken from page 1 (KSP only
 * returns a real range there). Returns whether it stopped early (`capped`).
 */
export async function fetchCategoryAllPages(opts: {
  query?: string;
  filters?: string;
}): Promise<{
  items: NonNullable<KspSearchResult["items"]>;
  total?: number | string;
  minMax?: KspSearchResult["minMax"];
  suggestion?: KspSearchResult["suggestion"];
  pagesFetched: number;
  capped: boolean;
}> {
  const items: NonNullable<KspSearchResult["items"]> = [];
  let total: number | string | undefined;
  let minMax: KspSearchResult["minMax"];
  let suggestion: KspSearchResult["suggestion"];
  let page = 1;
  let capped = false;

  while (true) {
    const r = await fetchCategory({ ...opts, page });
    if (page === 1) {
      total = r.products_total;
      minMax = r.minMax;
      suggestion = r.suggestion;
    }
    for (const it of r.items ?? []) items.push(it);
    if (!r.next) break;
    if (page >= MAX_ALL_PAGES) {
      capped = true;
      break;
    }
    page++;
  }

  return { items, total, minMax, suggestion, pagesFetched: page, capped };
}
