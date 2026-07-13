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
<summary>Tools</summary>

- **`search_products`** — search by product name (Hebrew or English), or narrow by filters (brand, size, spec, price, …) to list the products in a category. Returns names, prices, stock, and links.
- **`get_filters`** — see the filters available for a search or category (all screen sizes, brands, resolutions, features, …) and how many products match each, so a search can be narrowed precisely.
- **`get_product`** — full details for one product (by id or URL): price, stock, and size/config options; optionally specs, images, branch availability, delivery options, and similar items.

</details>

<details>
<summary>How it works</summary>

Talks directly to KSP's internal JSON API — the same one the website uses — so results are fast and structured, with no HTML scraping. Runs locally over stdio; no account, API key, or login required.

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
