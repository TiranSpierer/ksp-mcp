import { z } from "zod";
import { fetchCategory } from "../api/ksp.js";
import { mergeFilterIds } from "../text.js";
import { toYaml } from "../format.js";
import { stringArray } from "../schema.js";

export const getFiltersTool = {
  name: "get_filters",
  description:
    "Discover KSP's filter facets for a search term or category — filter groups (brand, size, resolution, features, energy, …) with each option's id and live product count. Feed chosen option ids to search_products' `filters`.",
  annotations: { readOnlyHint: true },
  schema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        "Free-text term to discover filters for (e.g. 'טלוויזיה', 'מקרר', 'laptop'). Use `query` or `filters`.",
      ),
    filters: stringArray()
      .optional()
      .describe(
        "Existing facet id(s) to refine within and see remaining options (e.g. ['3158'] for TVs, or ['3158..3388'] for 75\" TVs).",
      ),
  }),
  handler: async (args: { query?: string; filters?: string[] }) => {
    const filters = mergeFilterIds(args.filters);
    if (!filters && !args.query) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Provide `query` (free text) or `filters` (facet ids to refine within).",
          },
        ],
        isError: true,
      };
    }

    const r = await fetchCategory({ query: args.query, filters: filters || undefined });
    const f = r.filter ?? {};

    const groups: Array<Record<string, unknown>> = [];
    for (const g of Object.values(f)) {
      const opts = Object.values(g.tags ?? {})
        .filter((o) => o.action) // drop the active-node option (empty id)
        .map((o) => ({ name: o.name, id: o.action, count: o.products_count }));
      if (!opts.length) continue;
      const entry: Record<string, unknown> = { group: g.catName };
      const total = g.total ?? opts.length;
      // Flag when KSP truncated the group (hard cap of 30 options per group).
      if (total > opts.length) entry.showing = `${opts.length} of ${total} (top by relevance)`;
      entry.options = opts;
      groups.push(entry);
    }

    if (groups.length === 0) {
      const what = filters ? `filters ${filters}` : `"${args.query}"`;
      return {
        content: [
          { type: "text" as const, text: `No filter facets found for ${what}.` },
        ],
      };
    }

    const result: Record<string, unknown> = { total: r.products_total };
    if (filters) result.applied_filters = filters;
    result.hint =
      "Pass option ids to search_products(filters=[...]). Ids AND across groups, OR within a group; ids share the category prefix and merge automatically.";
    result.filter_groups = groups;

    return { content: [{ type: "text" as const, text: toYaml(result) }] };
  },
};
