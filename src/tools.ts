import { z } from "zod";

/**
 * Pure implementations of the plugin's capabilities.
 *
 * These functions contain no MCP wiring so they can be unit tested directly and
 * reused from anywhere (CLI, tests, or the MCP server in `server.ts`).
 */

export function echo(text: string): string {
  return text;
}

export function add(a: number, b: number): number {
  return a + b;
}

export interface TextStats {
  characters: number;
  words: number;
  lines: number;
}

export function textStats(text: string): TextStats {
  const words = text.trim().length === 0 ? [] : text.trim().split(/\s+/);
  return {
    characters: text.length,
    words: words.length,
    lines: text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length,
  };
}

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Declarative catalogue of the tools this plugin exposes. `server.ts` iterates
 * over this list to register each tool with the MCP server, which keeps the
 * wiring in one place and makes it trivial to add new tools.
 */
export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodRawShape;
  run: (args: Record<string, unknown>) => string;
}

export const tools: ToolDefinition[] = [
  {
    name: "echo",
    title: "Echo",
    description: "Return the provided text unchanged. Useful as a health check.",
    inputSchema: { text: z.string().describe("The text to echo back") },
    run: (args) => echo(args.text as string),
  },
  {
    name: "add",
    title: "Add",
    description: "Add two numbers and return the sum.",
    inputSchema: {
      a: z.number().describe("First addend"),
      b: z.number().describe("Second addend"),
    },
    run: (args) => String(add(args.a as number, args.b as number)),
  },
  {
    name: "text_stats",
    title: "Text statistics",
    description: "Count the characters, words, and lines in a piece of text.",
    inputSchema: { text: z.string().describe("The text to analyze") },
    run: (args) => JSON.stringify(textStats(args.text as string)),
  },
  {
    name: "slugify",
    title: "Slugify",
    description: "Convert text into a lowercase, URL-friendly slug.",
    inputSchema: { text: z.string().describe("The text to slugify") },
    run: (args) => slugify(args.text as string),
  },
];
