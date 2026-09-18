import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tools } from "./tools.js";

/**
 * Build and configure the MCP server, registering every tool declared in
 * `tools.ts`. The transport (stdio, HTTP, etc.) is chosen by the caller.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "agent-plugin-awesome",
    version: "0.1.0",
  });

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      (args: Record<string, unknown>) => ({
        content: [{ type: "text" as const, text: tool.run(args) }],
      }),
    );
  }

  return server;
}
