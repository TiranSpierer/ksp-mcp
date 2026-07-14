import { z } from "zod";
import { getItem, getItemRaw } from "../api/ksp.js";
import { KSP_WEB } from "../api/client.js";
import { shekel, extractUin, htmlToMarkdown } from "../text.js";
import { toYaml } from "../format.js";
import type { KspVariation, KspItemResult } from "../types/ksp.js";

// Below this many variations we list them all inline; above it we summarize
// by option axis (and the full list moves behind include_variations).
const VARIATION_INLINE_LIMIT = 8;

function mapProduct(p: unknown): unknown {
  if (p && typeof p === "object") {
    const o = p as Record<string, unknown>;
    return {
      uin: o.uin,
      name: o.name,
      price: shekel(o.price ?? o.min_price),
    };
  }
  return p;
}

export const getProductTool = {
  name: "get_product",
  description:
    "Get full details for one KSP product by UIN or URL: price, active promo/discount pricing (bms), stock, and variations. Specs, branch stock, images, delivery, and similar items are opt-in flags; include_raw dumps the entire untouched payload.",
  annotations: { readOnlyHint: true },
  schema: z.object({
    uin: z
      .string()
      .describe("Product UIN (e.g. '407256') or a full ksp.co.il/web/item/<uin> URL."),
    include_raw: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Return the entire raw KSP API payload untouched (no field selection or reshaping). When true, all other flags are ignored.",
      ),
    include_specs: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include the full specification table (converted to Markdown)."),
    include_variations: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "List every variation/config with its UIN + price. Off by default; a summary is always shown.",
      ),
    include_branches: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include per-store stock availability."),
    include_images: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include product image URLs."),
    include_delivery: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include all delivery/pickup options with prices and ETAs."),
    include_similar: z
      .boolean()
      .optional()
      .default(false)
      .describe("Include similar and complementary products."),
  }),
  handler: async (args: {
    uin: string;
    include_raw?: boolean;
    include_specs?: boolean;
    include_variations?: boolean;
    include_branches?: boolean;
    include_images?: boolean;
    include_delivery?: boolean;
    include_similar?: boolean;
  }) => {
    const uin = extractUin(args.uin);

    // Escape hatch: dump the entire untouched payload; ignore all other flags.
    if (args.include_raw) {
      const raw = await getItemRaw(uin);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(raw, null, 2) }],
      };
    }

    const r: KspItemResult = await getItem(uin);
    const d = r.data ?? {};
    const spec = r.specification ?? {};

    const out: Record<string, unknown> = { uin: d.uin ?? uin, name: d.name };
    if (spec.modalName) out.model = spec.modalName;
    if (d.brandName) out.brand = d.brandName;
    out.price = shekel(d.price);
    // KSP has no club/member price — regular + Eilat (tax-free) are the only
    // real tags. `min_price` only diverges on multi-variation products, where
    // it's the cheapest variation (already listed under `variations`), not a
    // discount, so we don't surface it as a separate price.
    if (d.eilatPrice) out.eilat_price = shekel(d.eilatPrice);
    out.in_stock = Boolean(d.addToCart);
    // Active promo pricing lives in bms[uin].discount, separate from data.price
    // (the list price). We surface just the real markdown — sale price + what the
    // campaign is — not the icons / cross-sell / duplicate-payment noise that
    // fills the rest of the bms block (available in full via include_raw). A
    // `discount` without a `value` is a cross-sell campaign, not a price cut, so
    // it's skipped here.
    const discounts = Object.entries(r.bms ?? {})
      .map(([itemUin, entry]) => {
        const dsc =
          entry && typeof entry === "object"
            ? (entry as Record<string, unknown>).discount
            : null;
        if (!dsc || typeof dsc !== "object") return null;
        const o = dsc as Record<string, unknown>;
        if (o.value == null) return null;
        return {
          uin: itemUin,
          price: shekel(o.value),
          eilat_price: o.value_eilat != null ? shekel(o.value_eilat) : undefined,
          about: typeof o.name === "string" ? o.name : undefined,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (discounts.length === 1) {
      const { uin: _uin, ...only } = discounts[0];
      out.discount = only;
    } else if (discounts.length > 1) {
      out.discount = discounts;
    }
    if (d.smalldesc) out.description = htmlToMarkdown(d.smalldesc);

    // --- Variations (adaptive: inline when few, summarized when many) ---
    const po = r.products_options ?? {};
    const axes = po.render?.tags ?? {};
    const idToName: Record<string, string> = {};
    const optionsByAxis: Record<string, string[]> = {};
    for (const key of Object.keys(axes)) {
      const axis = axes[key];
      const names: string[] = [];
      for (const item of axis.items ?? []) {
        idToName[String(item.id)] = item.name;
        names.push(item.name);
      }
      optionsByAxis[axis.name ?? key] = names;
    }
    const variations = po.variations ?? [];
    const labelFor = (v: KspVariation) =>
      Object.values(v.tags ?? {})
        .map((id) => idToName[String(id)] ?? String(id))
        .join(", ");

    if (variations.length) {
      const prices = variations
        .map((v) => Number(v.data?.price))
        .filter((n) => n && !Number.isNaN(n));
      const listAll =
        Boolean(args.include_variations) ||
        variations.length <= VARIATION_INLINE_LIMIT;
      if (listAll) {
        out.variations = variations.map((v) => ({
          label: labelFor(v),
          uin: v.data?.uin_item,
          price: shekel(v.data?.price),
        }));
      } else {
        out.variations = {
          count: variations.length,
          price_range: prices.length
            ? `${shekel(Math.min(...prices))} – ${shekel(Math.max(...prices))}`
            : undefined,
          options: optionsByAxis,
          note: "Pass include_variations: true for the full list with UINs.",
        };
      }
    }

    // --- Payments ---
    const pay = r.payments ?? {};
    if (pay.max_wo) {
      out.payments = `up to ${pay.max_wo} interest-free${
        pay.perPayment ? ` (₪${pay.perPayment}/mo)` : ""
      }`;
    }

    // --- Delivery (summary by default, full list opt-in) ---
    const delivery = r.delivery ?? [];
    if (delivery.length) {
      if (args.include_delivery) {
        out.delivery = delivery.map((x) => ({
          option: htmlToMarkdown(x.title) || x.type,
          price: shekel(x.price) ?? "₪0",
          eta_days: x.time ? `${x.time.min}–${x.time.max}` : undefined,
        }));
      } else {
        const first = delivery[0];
        out.delivery = `${htmlToMarkdown(first.title) || first.type}: ${
          shekel(first.price) ?? "₪0"
        }${first.time ? ` (${first.time.min}–${first.time.max} days)` : ""}`;
      }
    }

    // --- Opt-in extras ---
    if (args.include_specs) {
      out.specs = (spec.items ?? [])
        .map((s) => {
          const head = htmlToMarkdown(s.head) || "spec";
          const body = htmlToMarkdown(s.body);
          return body ? { [head]: body } : null;
        })
        .filter((row): row is Record<string, string> => row !== null);
    }

    if (args.include_branches) {
      const rawStock = r.stock;
      const stockArray = Array.isArray(rawStock)
        ? rawStock
        : rawStock && typeof rawStock === "object"
          ? Object.values(rawStock)
          : [];
      const branches = stockArray
        .map((s) => s?.name || s?.title)
        .filter((n): n is string => Boolean(n));
      out.branches = branches.length
        ? branches
        : "No per-store stock breakdown for this item — see in_stock / delivery for availability.";
    }

    if (args.include_images) {
      out.images = (r.images ?? [])
        .map((im) => {
          if (typeof im === "string") return im;
          return im?.sizes?.b?.src || im?.sizes?.s?.src || null;
        })
        .filter((u): u is string => Boolean(u));
    }

    if (args.include_similar) {
      const sim = Array.isArray(r.similarItem)
        ? r.similarItem
        : r.similarItem
          ? [r.similarItem]
          : [];
      const comp = Array.isArray(r.complementary_products)
        ? r.complementary_products
        : [];
      if (sim.length) out.similar = sim.map(mapProduct);
      if (comp.length) out.complementary = comp.map(mapProduct);
      if (!sim.length && !comp.length) out.similar = "None listed.";
    }

    out.url = `${KSP_WEB}/item/${d.uin ?? uin}`;

    return { content: [{ type: "text" as const, text: toYaml(out) }] };
  },
};
