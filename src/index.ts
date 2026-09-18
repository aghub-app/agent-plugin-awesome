import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

/**
 * Entry point: start the MCP server over stdio so it can be launched by an
 * agent host (Cursor, Claude Desktop, etc.).
 */
async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so we never corrupt the stdio JSON-RPC channel on stdout.
  console.error("agent-plugin-awesome MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error starting agent-plugin-awesome:", error);
  process.exit(1);
});
