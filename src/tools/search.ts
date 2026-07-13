import { z } from "zod";
import { fetchCategory } from "../api/ksp.js";
import { KSP_WEB } from "../api/client.js";
import { shekel, mergeFilterIds } from "../text.js";
import { toYaml } from "../format.js";
import { stringArray } from "../schema.js";
import type { KspSearchItem } from "../types/ksp.js";

export const searchProductsTool = {
  name: "search_products",
  description:
    "Search products on KSP (ksp.co.il), Israel's electronics retailer. Free-text `query`, or `filters` (facet ids from get_filters) for precise category filtering. Supports Hebrew and English.",
  annotations: { readOnlyHint: true },
  schema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        "Search term, Hebrew or English (e.g. 'lg oled 65', 'אוזניות'). Provide `query` or `filters`.",
      ),
    filters: stringArray()
      .optional()
      .describe(
        "Facet ids from get_filters (e.g. ['3158..137','3158..3388'] = Samsung 75\" TVs). Combined AND across groups, OR within a group. Use instead of/with query.",
      ),
    page: z.coerce
      .number()
      .int()
      .min(1)
      .optional()
      .default(1)
      .describe("Result page (12 products per page). Fetch further pages as needed."),
    include_details: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Add per-product description, thumbnail URL, and payment info (more tokens).",
      ),
  }),
  handler: async (args: {
    query?: string;
    filters?: string[];
    page?: number;
    include_details?: boolean;
  }) => {
    const filters = mergeFilterIds(args.filters);
    if (!filters && !args.query) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Provide `query` (free text) or `filters` (facet ids from get_filters).",
          },
        ],
        isError: true,
      };
    }

    const r = await fetchCategory({
      query: args.query,
      filters: filters || undefined,
      page: args.page ?? 1,
    });
    const items = r.items ?? [];

    const products = items.map((it: KspSearchItem) => {
      const out: Record<string, unknown> = {
        uin: it.uin,
        name: it.name,
        price: shekel(it.price),
      };
      const eilat = it.eilatPrice || it.min_eilat_price;
      if (eilat) out.eilat_price = shekel(eilat);
      if (it.brandName) out.brand = it.brandName;
      out.in_stock = Boolean(it.addToCart) && !it.outOfStock;
      const labels = (it.labels ?? [])
        .map((l) => l?.msg)
        .filter((m): m is string => Boolean(m));
      if (labels.length) out.labels = labels;

      if (args.include_details) {
        if (it.description) out.description = it.description;
        if (it.img) out.thumbnail = it.img;
        const p = it.payments;
        if (p?.max_num_payments_wo_interest) {
          out.payments = `up to ${p.max_num_payments_wo_interest} interest-free${
            p.estimated_payment ? ` (₪${p.estimated_payment}/mo)` : ""
          }`;
        }
      }
      out.url = `${KSP_WEB}/item/${it.uin}`;
      return out;
    });

    if (products.length === 0) {
      const what = filters ? `filters ${filters}` : `"${args.query}"`;
      return {
        content: [
          { type: "text" as const, text: `No products found for ${what} on KSP.` },
        ],
      };
    }

    const mm = r.minMax;
    const result: Record<string, unknown> = { total: r.products_total };
    if (filters) result.applied_filters = filters;
    if (mm && (mm.min || mm.max))
      result.price_range = `${shekel(mm.min)} – ${shekel(mm.max)}`;
    if (r.next) result.next_page = r.next;
    const suggestions = (r.suggestion?.phrases ?? [])
      .map((p) => p?.text)
      .filter((t): t is string => Boolean(t));
    if (suggestions.length) result.suggestions = suggestions;
    result.products = products;

    return { content: [{ type: "text" as const, text: toYaml(result) }] };
  },
};
