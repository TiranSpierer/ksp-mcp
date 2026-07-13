# CLAUDE.md

KSP MCP server (ksp.co.il). 2 tools over stdio, read-only. No auth — plain `fetch` with browser headers past Cloudflare.

## Build & Test

```bash
npm run reload
```

Then call `mcp__ksp-dev__*` tools directly to verify. The dev server is in `.mcp.json`.

## Architecture

ES Modules, TypeScript (ES2022, NodeNext). Output → `dist/`.

- `api/client.ts` — `kspFetch<T>()`, the single fetch choke point. Plain `fetch` to `https://ksp.co.il/m_action/api` with a realistic desktop-Chrome header set (Cloudflare keys on the UA; a stub UA gets the "Just a moment…" HTML). Detects an HTML challenge by a leading `<` and throws a clear message. Never call `fetch` directly elsewhere.
- `api/ksp.ts` — typed wrappers: `searchProducts()` (`/category/?search=`), `getItem()` (`/item/<uin>`).
- `types/ksp.ts` — lean interfaces for the fields we read (raw payloads are huge; we don't model all of it).
- `text.ts` — `htmlToMarkdown()` (turndown; only for HTML fields), `extractUin()` (split-based, no regex), `shekel()` price formatter.
- `tools/` — one file per tool, each exports a `ToolDefinition`. Registered in `tools/index.ts`.
- `server.ts` — `createServer()`; registers tools, shared try/catch → `{ isError: true }`.
- `format.ts` — `toYaml()`. All structured responses are YAML for token efficiency.

## Conventions

- **No regex / HTML parsing** for data extraction. Read JSON scalars directly. The only HTML (spec bodies, `smalldesc`) goes through `turndown` (maintained lib) → Markdown.
- Responses: YAML via `toYaml()`; plain text for empty/no-result cases.
- `get_product` is lean by default; bloaty data (specs, all variations, branches, images, full delivery, similar) is opt-in via `include_*` flags.
- `search_products` returns useful fields by default; `include_details` adds the bloaty per-item extras.
- Tool descriptions: one sentence, no examples.

## Making Changes

- New tool: add API wrapper → create `ToolDefinition` → register in `tools/index.ts` → update README + CLAUDE.md.
- After any change: `npm run reload`, test with `mcp__ksp-dev__*`.
