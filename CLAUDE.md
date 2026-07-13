# CLAUDE.md

KSP MCP server (ksp.co.il). 3 tools over stdio, read-only. No auth — plain `fetch` with browser headers past Cloudflare.

## Build & Test

```bash
npm run reload
```

Then call `mcp__ksp-dev__*` tools directly to verify. The dev server is in `.mcp.json`.

## Architecture

ES Modules, TypeScript (ES2022, NodeNext). Output → `dist/`.

- `api/client.ts` — `kspFetch<T>()`, the single fetch choke point. Plain `fetch` to `https://ksp.co.il/m_action/api` with a realistic desktop-Chrome header set (Cloudflare keys on the UA; a stub UA gets the "Just a moment…" HTML). Detects an HTML challenge by a leading `<` and throws a clear message. Never call `fetch` directly elsewhere.
- `api/ksp.ts` — `fetchCategory({query?, filters?, page?})` (`/category/?search=` for text, `/category/<id>..<id>` for facet paths) and `getItem()` (`/item/<uin>`).
- `types/ksp.ts` — lean interfaces for the fields we read (raw payloads are huge; we don't model all of it), including `KspFilterGroup`/`KspFilterOption`.
- `text.ts` — `htmlToMarkdown()` (turndown; only for HTML fields), `extractUin()` (split-based, no regex), `shekel()`, `mergeFilterIds()` (split ids on `..`, dedupe, rejoin).
- `schema.ts` — `stringArray()` zod preprocess (accepts array / JSON-string / bare string).
- `tools/` — one file per tool, each exports a `ToolDefinition`. Registered in `tools/index.ts`.
- `server.ts` — `createServer()`; registers tools, shared try/catch → `{ isError: true }`.
- `format.ts` — `toYaml()`. All structured responses are YAML for token efficiency.

## Filtering model (get_filters + search_products `filters`)

- KSP filtering = a path of tag ids joined by `..`: `/category/<catId>..<tagId>..<tagId>`. Same facet group = OR, different groups = AND.
- The category response returns the whole facet tree in `result.filter` (groups → options with `action` id + `products_count`), so **no filter is ever hardcoded** — we surface KSP's own facets and shuttle opaque ids back.
- KSP caps each group at 30 options; `group.total` gives the true count, so `get_filters` shows "showing N of M" when truncated.
- Option `action`s share the category prefix (e.g. `3158..137`), so `mergeFilterIds` de-dupes segments and Claude can pass option ids verbatim.

## Conventions

- **No regex / HTML parsing** for data extraction. Read JSON scalars directly. The only HTML (spec bodies, `smalldesc`) goes through `turndown` (maintained lib) → Markdown.
- KSP has **no club/member price** — only regular + Eilat (tax-free). `min_price` is cheapest-variation on multi-config items, not a discount; don't surface it as a price.
- Responses: YAML via `toYaml()`; plain text for empty/no-result cases.
- `get_product` is lean by default; bloaty data (specs, all variations, branches, images, full delivery, similar) is opt-in via `include_*` flags. `search_products` adds bloaty per-item extras via `include_details`.
- Tool descriptions: one sentence, no examples.

## Making Changes

- New tool: add API wrapper → create `ToolDefinition` → register in `tools/index.ts` → update README + CLAUDE.md.
- After any change: `npm run reload`, test with `mcp__ksp-dev__*`.
