import { existsSync } from "node:fs";
import { isAbsolute, join, normalize, relative, resolve } from "node:path";
import { readJsonFile } from "./io.ts";
import { placeholder } from "./placeholder.ts";
import {
	type AgentMcpConfig,
	type AgentMcpServer,
	type CursorPluginManifest,
	type HttpServer,
	isJsonObject,
	type JsonObject,
	MCP_SCHEMA,
	type StdioServer,
} from "./types.ts";

const PLACEHOLDER = /\$\{[^}]+\}/;
const RESERVED_ENV = new Set(["PLUGIN_ROOT", "PLUGIN_DATA"]);
const PLUGIN_ROOT = placeholder("PLUGIN_ROOT");
const PLUGIN_DATA = placeholder("PLUGIN_DATA");
const CURSOR_PLUGIN_ROOT = placeholder("CURSOR_PLUGIN_ROOT");
const CURSOR_PLUGIN_DATA = placeholder("CURSOR_PLUGIN_DATA");

export type McpConversion = {
	mcp: AgentMcpConfig | undefined;
	cursorExtras: Record<string, JsonObject>;
	warnings: string[];
};

export function convertPluginMcp(
	pluginRoot: string,
	cursor: CursorPluginManifest,
): McpConversion {
	const { servers, warnings } = loadCursorMcpServers(
		pluginRoot,
		cursor.mcpServers,
	);
	return convertMcpServers(servers, warnings);
}

export function convertMcpServers(
	servers: Record<string, unknown>,
	incomingWarnings: string[] = [],
): McpConversion {
	const warnings = [...incomingWarnings];
	const mcpServers: Record<string, AgentMcpServer> = {};
	const cursorExtras: Record<string, JsonObject> = {};

	for (const [name, value] of Object.entries(servers)) {
		if (!isJsonObject(value)) {
			warnings.push(`skip MCP server ${name}: expected an object`);
			continue;
		}

		const converted = convertOneServer(name, value, warnings);
		if (converted.server) {
			mcpServers[name] = converted.server;
		}
		if (Object.keys(converted.cursorExtra).length > 0) {
			cursorExtras[name] = converted.cursorExtra;
		}
	}

	return {
		mcp:
			Object.keys(mcpServers).length > 0
				? { $schema: MCP_SCHEMA, mcpServers }
				: undefined,
		cursorExtras,
		warnings,
	};
}

export function loadCursorMcpServers(
	pluginRoot: string,
	mcpServers: CursorPluginManifest["mcpServers"],
): { servers: Record<string, unknown>; warnings: string[] } {
	const warnings: string[] = [];
	const servers: Record<string, unknown> = {};
	const sources: Array<string | JsonObject> = [];

	if (mcpServers === undefined) {
		const defaultPath = join(pluginRoot, "mcp.json");
		if (existsSync(defaultPath)) {
			sources.push("./mcp.json");
		}
	} else if (Array.isArray(mcpServers)) {
		sources.push(...mcpServers);
	} else {
		sources.push(mcpServers);
	}

	for (const source of sources) {
		if (typeof source === "string") {
			const filePath = resolvePluginPath(pluginRoot, source);
			if (!filePath) {
				warnings.push(`skip MCP path ${source}: escapes plugin root`);
				continue;
			}
			if (!existsSync(filePath)) {
				warnings.push(`skip MCP path ${source}: file not found`);
				continue;
			}
			mergeServerMap(
				servers,
				serversFromUnknown(readJsonFile(filePath)),
				warnings,
			);
			continue;
		}
		mergeServerMap(servers, serversFromUnknown(source), warnings);
	}

	return { servers, warnings };
}

function convertOneServer(
	name: string,
	raw: JsonObject,
	warnings: string[],
): { server: AgentMcpServer | undefined; cursorExtra: JsonObject } {
	const cursorExtra: JsonObject = {};
	const known = new Set([
		"type",
		"command",
		"args",
		"env",
		"cwd",
		"url",
		"headers",
		"auth",
	]);
	for (const [key, value] of Object.entries(raw)) {
		if (!known.has(key)) {
			cursorExtra[key] = value;
		}
	}
	if (isJsonObject(raw.auth)) {
		cursorExtra.auth = raw.auth;
	}

	const transport = inferTransport(raw);
	if (!transport) {
		warnings.push(`skip MCP server ${name}: missing type, command, and url`);
		return { server: undefined, cursorExtra };
	}

	if (transport === "stdio") {
		return {
			server: convertStdio(name, raw, cursorExtra, warnings),
			cursorExtra,
		};
	}

	return {
		server: convertHttp(name, transport, raw, cursorExtra, warnings),
		cursorExtra,
	};
}

function convertStdio(
	name: string,
	raw: JsonObject,
	cursorExtra: JsonObject,
	warnings: string[],
): StdioServer | undefined {
	const command = rewritePlaceholders(optionalString(raw.command) ?? "");
	if (!command) {
		warnings.push(`skip MCP server ${name}: stdio server is missing command`);
		return undefined;
	}
	if (command.includes(" ")) {
		warnings.push(
			`MCP server ${name}: command should be a single executable token`,
		);
	}

	const server: StdioServer = {
		type: "stdio",
		command: normalizeCommand(command, warnings, name),
	};

	if (
		Array.isArray(raw.args) &&
		raw.args.every((item) => typeof item === "string")
	) {
		server.args = raw.args.map((item) => rewritePlaceholders(item));
	} else if (raw.args !== undefined) {
		cursorExtra.args = raw.args;
		warnings.push(`MCP server ${name}: dropped non-string args`);
	}

	if (isJsonObject(raw.env)) {
		const env: Record<string, string> = {};
		for (const [key, value] of Object.entries(raw.env)) {
			if (RESERVED_ENV.has(key)) {
				warnings.push(`MCP server ${name}: dropped reserved env ${key}`);
				continue;
			}
			if (typeof value === "string") {
				env[key] = rewritePlaceholders(value);
			}
		}
		if (Object.keys(env).length > 0) {
			server.env = env;
		}
	}

	const cwd = optionalString(raw.cwd);
	if (cwd) {
		const normalized = normalizeCwd(rewritePlaceholders(cwd));
		if (normalized) {
			server.cwd = normalized;
		} else {
			warnings.push(`MCP server ${name}: dropped invalid cwd ${cwd}`);
		}
	}

	return server;
}

function convertHttp(
	name: string,
	type: HttpServer["type"],
	raw: JsonObject,
	cursorExtra: JsonObject,
	warnings: string[],
): HttpServer | undefined {
	const url = optionalString(raw.url);
	if (!url) {
		warnings.push(`skip MCP server ${name}: ${type} server is missing url`);
		return undefined;
	}

	const server: HttpServer = { type, url };
	if (isJsonObject(raw.headers)) {
		const portable: Record<string, string> = {};
		const cursorHeaders: Record<string, string> = {};
		const seen = new Map<string, string>();

		for (const [headerName, value] of Object.entries(raw.headers)) {
			if (typeof value !== "string") {
				continue;
			}
			const folded = headerName.toLowerCase();
			if (seen.has(folded) && seen.get(folded) !== headerName) {
				warnings.push(
					`MCP server ${name}: duplicate header ${headerName} after case folding`,
				);
				continue;
			}
			seen.set(folded, headerName);
			if (PLACEHOLDER.test(value)) {
				cursorHeaders[headerName] = value;
			} else {
				portable[headerName] = value;
			}
		}

		if (Object.keys(portable).length > 0) {
			server.headers = portable;
		}
		if (Object.keys(cursorHeaders).length > 0) {
			cursorExtra.headers = cursorHeaders;
			warnings.push(
				`MCP server ${name}: moved placeholder headers into com.cursor extensions`,
			);
		}
	}

	return server;
}

function inferTransport(
	raw: JsonObject,
): "stdio" | "streamable-http" | "sse" | undefined {
	const type = optionalString(raw.type);
	if (type === "stdio") {
		return "stdio";
	}
	if (type === "sse") {
		return "sse";
	}
	if (
		type === "http" ||
		type === "streamable-http" ||
		type === "streamable_http"
	) {
		return "streamable-http";
	}
	if (typeof raw.command === "string") {
		return "stdio";
	}
	if (typeof raw.url === "string") {
		return "streamable-http";
	}
	return undefined;
}

function serversFromUnknown(value: unknown): Record<string, unknown> {
	if (!isJsonObject(value)) {
		return {};
	}
	if (isJsonObject(value.mcpServers)) {
		return value.mcpServers;
	}
	const values = Object.values(value);
	if (
		values.length > 0 &&
		values.every(
			(item) =>
				isJsonObject(item) &&
				("command" in item || "url" in item || "type" in item),
		)
	) {
		return value;
	}
	return {};
}

function mergeServerMap(
	target: Record<string, unknown>,
	incoming: Record<string, unknown>,
	warnings: string[],
): void {
	for (const [name, server] of Object.entries(incoming)) {
		if (name in target) {
			warnings.push(
				`MCP server ${name}: later definition replaced an earlier one`,
			);
		}
		target[name] = server;
	}
}

function normalizeCommand(
	command: string,
	warnings: string[],
	name: string,
): string {
	if (
		command.startsWith("./") ||
		(!command.includes("/") && !command.includes("\\"))
	) {
		return command;
	}
	if (isAbsolute(command)) {
		warnings.push(
			`MCP server ${name}: absolute command is not a plugin-relative path`,
		);
		return command;
	}
	return `./${command}`;
}

function normalizeCwd(cwd: string): string | undefined {
	if (
		cwd === PLUGIN_ROOT ||
		cwd.startsWith(`${PLUGIN_ROOT}/`) ||
		cwd === PLUGIN_DATA ||
		cwd.startsWith(`${PLUGIN_DATA}/`) ||
		cwd.startsWith("./")
	) {
		return cwd;
	}
	if (cwd.includes("..") || isAbsolute(cwd)) {
		return undefined;
	}
	return `./${cwd}`;
}

function rewritePlaceholders(value: string): string {
	return value
		.replaceAll(CURSOR_PLUGIN_ROOT, PLUGIN_ROOT)
		.replaceAll(CURSOR_PLUGIN_DATA, PLUGIN_DATA);
}

function resolvePluginPath(
	pluginRoot: string,
	configured: string,
): string | undefined {
	const relativePath = configured.replace(/^\.\//, "");
	const resolved = resolve(pluginRoot, relativePath);
	const rel = relative(pluginRoot, resolved);
	if (
		rel.startsWith("..") ||
		isAbsolute(rel) ||
		normalize(rel).startsWith("..")
	) {
		return undefined;
	}
	return resolved;
}

function optionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}
