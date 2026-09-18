export type JsonObject = Record<string, unknown>;

export const PLUGIN_SCHEMA =
	"https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
export const MCP_SCHEMA =
	"https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";
export const CURSOR_EXTENSION = "com.cursor";
export const AGHUB_EXTENSION = "moe.akr.aghub";

export const PLUGIN_NAME_PATTERN =
	/^(?!.*(?:--|\\.\\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/;

export const CURSOR_COMPONENT_DIRS = [
	"rules",
	"agents",
	"commands",
	"hooks",
] as const;

export type CursorComponentDir = (typeof CURSOR_COMPONENT_DIRS)[number];

export type CursorPluginManifest = {
	name: string;
	displayName?: string;
	description?: string;
	version?: string;
	author?: JsonObject;
	publisher?: string;
	homepage?: string;
	repository?: string;
	license?: string;
	logo?: string;
	keywords?: string[];
	category?: string;
	tags?: string[];
	minClientVersions?: JsonObject;
	commands?: string | string[];
	agents?: string | string[];
	skills?: string | string[];
	rules?: string | string[];
	hooks?: string | JsonObject;
	variables?: JsonObject;
	mcpServers?: string | JsonObject | Array<string | JsonObject>;
};

export type AgentAuthor = {
	name?: string;
	email?: string;
	url?: string;
};

export type AgentPluginManifest = {
	$schema: typeof PLUGIN_SCHEMA;
	name: string;
	version?: string;
	description?: string;
	author?: AgentAuthor;
	homepage?: string;
	repository?: string;
	license?: string;
	keywords?: string[];
	extensions?: Record<string, JsonObject>;
};

export type StdioServer = {
	type: "stdio";
	command: string;
	args?: string[];
	env?: Record<string, string>;
	cwd?: string;
};

export type HttpServer = {
	type: "streamable-http" | "sse";
	url: string;
	headers?: Record<string, string>;
};

export type AgentMcpServer = StdioServer | HttpServer;

export type AgentMcpConfig = {
	$schema: typeof MCP_SCHEMA;
	mcpServers: Record<string, AgentMcpServer>;
};

export type ConvertResult = {
	name: string;
	source: string;
	output: string;
	warnings: string[];
	hasSkills: boolean;
	mcpServers: string[];
	cursorComponents: string[];
};

export function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
