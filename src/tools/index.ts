import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { searchProductsTool } from "./search.js";
import { getProductTool } from "./products.js";

export interface ToolDefinition {
  name: string;
  description: string;
  schema: import("zod").ZodType;
  annotations?: ToolAnnotations;
  handler: (
    args: any,
  ) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>;
}

export const tools: ToolDefinition[] = [searchProductsTool, getProductTool];
