# agent-plugin-awesome

An awesome [MCP (Model Context Protocol)](https://modelcontextprotocol.io) agent
plugin, written in TypeScript. It runs as a server over stdio and exposes a small
set of handy tools that any MCP-compatible agent host (Cursor, Claude Desktop,
etc.) can call.

## Tools

| Tool | Description |
| --- | --- |
| `echo` | Return the provided text unchanged (health check). |
| `add` | Add two numbers and return the sum. |
| `text_stats` | Count the characters, words, and lines in a piece of text. |
| `slugify` | Convert text into a lowercase, URL-friendly slug. |

## Requirements

- Node.js >= 20 (developed against Node 22)
- npm

## Getting started

```bash
npm ci          # install dependencies
npm run build   # compile TypeScript to dist/
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the MCP server from source with `tsx`. |
| `npm start` | Run the compiled server (`dist/index.js`). |
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm run typecheck` | Type-check without emitting. |
| `npm run lint` | Lint the codebase with ESLint. |
| `npm test` | Run the unit tests with Vitest. |
| `npm run demo` | End-to-end demo: spawn the server and call every tool over stdio. |

## Using the plugin with an agent host

Add the plugin to your MCP client configuration. For example:

```json
{
  "mcpServers": {
    "agent-plugin-awesome": {
      "command": "node",
      "args": ["/absolute/path/to/agent-plugin-awesome/dist/index.js"]
    }
  }
}
```

Run `npm run build` first so `dist/index.js` exists.

## Project layout

```
src/
  tools.ts     Pure tool implementations + the tool catalogue
  server.ts    MCP server wiring (registers each tool)
  index.ts     Entry point (starts the server over stdio)
test/
  tools.test.ts
scripts/
  demo-client.ts   End-to-end stdio client demo
```

## Development environment (Cloud Agents)

This repository ships a [`.cursor/environment.json`](.cursor/environment.json)
so Cursor Cloud Agents install dependencies and build automatically on boot.
