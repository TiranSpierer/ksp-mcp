import { z } from "zod";
import { writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getItem, itemImageUrls } from "../api/ksp.js";
import { fetchBinary } from "../api/client.js";
import { extractUin } from "../text.js";
import { toYaml } from "../format.js";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/gif": ".gif",
};

/** Derive a file extension from a URL path (ignoring query/hash). */
function extFromUrl(url: string): string {
  const clean = url.split("?")[0].split("#")[0];
  const slash = clean.lastIndexOf("/");
  const dot = clean.lastIndexOf(".");
  return dot > slash ? clean.slice(dot) : "";
}

export const getProductImagesTool = {
  name: "get_product_images",
  description:
    "Download all images for a KSP product (by UIN or URL) to the OS temp directory and return their local file paths. Open the paths to view the images.",
  annotations: { readOnlyHint: true },
  schema: z.object({
    uin: z
      .string()
      .describe("Product UIN (e.g. '402265') or a full ksp.co.il/web/item/<uin> URL."),
  }),
  handler: async (args: { uin: string }) => {
    const uin = extractUin(args.uin);
    const item = await getItem(uin);
    const urls = itemImageUrls(item);

    if (urls.length === 0) {
      return {
        content: [
          { type: "text" as const, text: `No images found for product ${uin}.` },
        ],
      };
    }

    // os.tmpdir() + path.join keep this correct on macOS/Linux/Windows.
    const dir = join(tmpdir(), "ksp-mcp", uin);
    await mkdir(dir, { recursive: true });

    const results = await Promise.all(
      urls.map(async (url, idx) => {
        try {
          const { buffer, contentType } = await fetchBinary(url);
          const ext = EXT_BY_MIME[contentType] || extFromUrl(url) || ".jpg";
          const path = join(dir, `${uin}_${idx + 1}${ext}`);
          await writeFile(path, buffer);
          return { path };
        } catch {
          return { failed: url };
        }
      }),
    );

    const paths = results
      .map((r) => r.path)
      .filter((p): p is string => Boolean(p));
    const failed = results.filter((r) => r.failed).length;

    if (paths.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${urls.length} image(s) for ${uin} but all downloads failed.`,
          },
        ],
        isError: true,
      };
    }

    const out: Record<string, unknown> = { uin };
    if (item.data?.name) out.name = item.data.name;
    out.count = paths.length;
    if (failed) out.failed = failed;
    out.images = paths;
    out.note = "Open these file paths to view the images.";

    return { content: [{ type: "text" as const, text: toYaml(out) }] };
  },
};
