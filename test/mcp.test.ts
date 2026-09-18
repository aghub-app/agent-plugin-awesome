import { expect, test } from "bun:test";
import { convertMcpServers } from "../src/mcp.ts";
import { placeholder } from "../src/placeholder.ts";
import { MCP_SCHEMA } from "../src/types.ts";

test("maps Cursor http MCP to streamable-http and strips placeholder headers", () => {
	const result = convertMcpServers({
		github: {
			type: "http",
			url: "https://api.githubcopilot.com/mcp/",
			headers: {
				Authorization: `Bearer ${placeholder("GITHUB_PERSONAL_ACCESS_TOKEN")}`,
			},
		},
	});

	expect(result.mcp).toEqual({
		$schema: MCP_SCHEMA,
		mcpServers: {
			github: {
				type: "streamable-http",
				url: "https://api.githubcopilot.com/mcp/",
			},
		},
	});
	expect(result.cursorExtras.github).toEqual({
		headers: {
			Authorization: `Bearer ${placeholder("GITHUB_PERSONAL_ACCESS_TOKEN")}`,
		},
	});
});

test("infers stdio from a command-only Cursor MCP entry", () => {
	const result = convertMcpServers({
		playwright: {
			command: "npx",
			args: ["-y", "@playwright/mcp@latest"],
		},
	});

	expect(result.mcp?.mcpServers.playwright).toEqual({
		type: "stdio",
		command: "npx",
		args: ["-y", "@playwright/mcp@latest"],
	});
});

test("infers streamable-http from a url-only entry and parks Cursor auth", () => {
	const result = convertMcpServers({
		gong: {
			url: "https://mcp.gong.io/mcp",
			auth: {
				CLIENT_ID: placeholder("CLIENT_ID"),
				CLIENT_SECRET: placeholder("CLIENT_SECRET"),
			},
		},
	});

	expect(result.mcp?.mcpServers.gong).toEqual({
		type: "streamable-http",
		url: "https://mcp.gong.io/mcp",
	});
	expect(result.cursorExtras.gong).toEqual({
		auth: {
			CLIENT_ID: placeholder("CLIENT_ID"),
			CLIENT_SECRET: placeholder("CLIENT_SECRET"),
		},
	});
});

test("rewrites Cursor plugin-root placeholders and drops reserved env keys", () => {
	const result = convertMcpServers({
		local: {
			type: "stdio",
			command: "bin/server",
			cwd: "data",
			env: {
				CONFIG: `${placeholder("CURSOR_PLUGIN_ROOT")}/config.json`,
				PLUGIN_ROOT: "/tmp/should-not-survive",
			},
		},
	});

	expect(result.mcp?.mcpServers.local).toEqual({
		type: "stdio",
		command: "./bin/server",
		cwd: "./data",
		env: {
			CONFIG: `${placeholder("PLUGIN_ROOT")}/config.json`,
		},
	});
});
