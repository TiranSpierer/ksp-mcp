import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tools } from "./tools/index.js";
import { log } from "./log.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "ksp-mcp-server",
    version: "1.0.0",
  });

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description,
        inputSchema: tool.schema as any,
        ...(tool.annotations ? { annotations: tool.annotations } : {}),
      },
      async (args: unknown) => {
        log(`Tool called: ${tool.name}`);
        try {
          return await tool.handler(args);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          log(`Tool error (${tool.name}): ${message}`);
          return {
            content: [{ type: "text" as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      },
    );
  }

  log(`Registered ${tools.length} tools`);
  return server;
}
