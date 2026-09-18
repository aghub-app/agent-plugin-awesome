import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * End-to-end demo: spawn the plugin as a subprocess over stdio, list its tools,
 * and invoke each one — exactly how an agent host would use the plugin.
 */
async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "src/index.ts"],
  });

  const client = new Client({ name: "demo-client", version: "0.1.0" });
  await client.connect(transport);

  const { tools } = await client.listTools();
  console.log(`Connected. Server exposes ${tools.length} tools:`);
  for (const tool of tools) {
    console.log(`  - ${tool.name}: ${tool.description}`);
  }

  const calls: Array<{ name: string; args: Record<string, unknown> }> = [
    { name: "echo", args: { text: "hello from the demo client" } },
    { name: "add", args: { a: 21, b: 21 } },
    { name: "text_stats", args: { text: "one two three\nfour" } },
    { name: "slugify", args: { text: "Awesome Agent Plugin!" } },
  ];

  console.log("\nInvoking tools:");
  for (const call of calls) {
    const result = await client.callTool({
      name: call.name,
      arguments: call.args,
    });
    const content = result.content as Array<{ type: string; text?: string }>;
    const text = content.map((c) => c.text ?? "").join("");
    console.log(`  ${call.name}(${JSON.stringify(call.args)}) => ${text}`);
  }

  await client.close();
  console.log("\nDemo complete.");
}

main().catch((error) => {
  console.error("Demo failed:", error);
  process.exit(1);
});
