// Lean types for the KSP m_action API. We only type the fields we actually
// read; raw responses carry far more. Index signatures keep access flexible
// without forcing us to model KSP's entire (large, changing) payload.

export interface KspLabel {
  msg?: string;
  [k: string]: unknown;
}

export interface KspPayments {
  max_num_payments_wo_interest?: number | string;
  estimated_payment?: number | string;
  max_wo?: number | string;
  perPayment?: number | string;
  [k: string]: unknown;
}

/** A product card in search results (result.items[]). */
export interface KspSearchItem {
  uin: number | string;
  name?: string;
  description?: string;
  price?: number;
  min_price?: number;
  eilatPrice?: number;
  min_eilat_price?: number;
  brandName?: string;
  img?: string;
  addToCart?: boolean | number;
  outOfStock?: boolean;
  labels?: KspLabel[];
  payments?: KspPayments;
  [k: string]: unknown;
}

export interface KspSearchResult {
  products_total?: number | string;
  items?: KspSearchItem[];
  next?: number;
  minMax?: { min?: number; max?: number; [k: string]: unknown };
  suggestion?: { phrases?: { text?: string }[] };
  filter?: Record<string, KspFilterGroup>;
  [k: string]: unknown;
}

/** One selectable option inside a filter group (e.g. a brand, a size). */
export interface KspFilterOption {
  /** The `..`-joined tag-id path to apply this option (e.g. "3158..137"). */
  action?: string;
  name?: string;
  products_count?: number;
  [k: string]: unknown;
}

/** A filter facet group (e.g. brand, size, resolution). */
export interface KspFilterGroup {
  catName?: string;
  hide?: boolean;
  /** True number of options (KSP caps `tags` at 30 per group). */
  total?: number;
  tags?: Record<string, KspFilterOption>;
  [k: string]: unknown;
}

export interface KspVariationAxis {
  name?: string;
  items?: { id: number | string; name: string }[];
  [k: string]: unknown;
}

export interface KspVariation {
  data?: { uin_item?: number | string; price?: number | string; [k: string]: unknown };
  tags?: Record<string, number | string>;
  [k: string]: unknown;
}

export interface KspSpecRow {
  head?: string;
  body?: string;
  [k: string]: unknown;
}

export interface KspItemResult {
  data?: {
    uin?: number | string;
    name?: string;
    smalldesc?: string;
    price?: number;
    min_price?: number;
    eilatPrice?: number | null;
    brandName?: string;
    addToCart?: boolean | number;
    [k: string]: unknown;
  };
  products_options?: {
    render?: { tags?: Record<string, KspVariationAxis> };
    variations?: KspVariation[];
  };
  specification?: { items?: KspSpecRow[]; modalName?: string; [k: string]: unknown };
  images?: Array<
    | {
        sizes?: Record<
          string,
          { src?: string; metadata?: { width?: number | string; height?: number | string } }
        >;
      }
    | string
  >;
  delivery?: Array<{
    title?: string;
    type?: string;
    price?: number | string;
    time?: { min?: number; max?: number };
    [k: string]: unknown;
  }>;
  stock?: Array<{ name?: string; title?: string; [k: string]: unknown }>;
  payments?: KspPayments;
  similarItem?: unknown;
  complementary_products?: unknown[];
  [k: string]: unknown;
}
