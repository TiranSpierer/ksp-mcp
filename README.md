# ksp-mcp

MCP server for [KSP](https://ksp.co.il) — Israel's electronics retailer. Search products and fetch product details straight from KSP's internal JSON API.

#### Claude Code installation

```bash
claude mcp add ksp -s user -- npx -y git+https://github.com/tiranspierer/ksp-mcp.git
```

<details>
<summary>Manual MCP config</summary>

```json
{
  "mcpServers": {
    "ksp": {
      "command": "npx",
      "args": ["-y", "git+https://github.com/tiranspierer/ksp-mcp.git"]
    }
  }
}
```

</details>

---

<details>
<summary>Tools (2)</summary>

| Tool | Description |
|---|---|
| `search_products` | Search products by Hebrew/English query. Returns name, price, club/Eilat price, brand, stock, labels, URL. `include_details` adds description/thumbnail/payments. |
| `get_product` | Full detail for one product by UIN or URL: price, stock, and variations. Opt-in flags: `include_specs`, `include_variations`, `include_branches`, `include_images`, `include_delivery`, `include_similar`. |

</details>

<details>
<summary>How it works</summary>

KSP is a React SPA backed by an internal JSON API at `https://ksp.co.il/m_action/api/`:

- **Search:** `GET /category/?search=<query>&page=<n>` → `result.items[]`
- **Product:** `GET /item/<uin>` → `result.{data, products_options, specification, …}`

The API sits behind Cloudflare, but a plain `fetch` with a realistic browser `User-Agent` (+ `Accept-Language`/`Referer`) returns clean JSON — no cookies, no browser automation. A stub UA gets the "Just a moment…" challenge, so the header set matters.

Fields consumed from the API are plain JSON scalars. The only HTML fields (spec bodies, short description) are converted to Markdown with [`turndown`](https://github.com/mixmark-io/turndown) rather than hand-rolled parsing — low maintenance, and Markdown reads well for the model.

</details>

<details>
<summary>Requirements</summary>

- Node.js 20+

</details>

<details>
<summary>Local development</summary>

```bash
npm install   # auto-builds via prepare
npm run reload  # rebuild + restart the dev server
```

The `.mcp.json` at the project root registers a `ksp-dev` server pointing at `dist/index.js`.

</details>
