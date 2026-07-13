import { kspFetch } from "./client.js";
import type { KspSearchResult, KspItemResult } from "../types/ksp.js";

/** Search products. 12 results per page. */
export async function searchProducts(
  query: string,
  page: number,
): Promise<KspSearchResult> {
  const params = new URLSearchParams({ search: query });
  if (page > 1) params.set("page", String(page));
  const json = await kspFetch<{ result: KspSearchResult }>(
    `/category/?${params.toString()}`,
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
