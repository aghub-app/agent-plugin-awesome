import {
	type AgentAuthor,
	type AgentPluginManifest,
	CURSOR_COMPONENT_DIRS,
	CURSOR_EXTENSION,
	type CursorPluginManifest,
	isJsonObject,
	type JsonObject,
	PLUGIN_NAME_PATTERN,
	PLUGIN_SCHEMA,
} from "./types.ts";

const PORTABLE_KEYS = new Set([
	"name",
	"version",
	"description",
	"author",
	"homepage",
	"repository",
	"license",
	"keywords",
]);

const CURSOR_SCALAR_KEYS = [
	"displayName",
	"publisher",
	"logo",
	"category",
] as const;

const CURSOR_OBJECT_KEYS = ["minClientVersions", "variables"] as const;

export function toPluginName(raw: string): string {
	if (PLUGIN_NAME_PATTERN.test(raw) && raw.length <= 64) {
		return raw;
	}

	let name = raw.trim().toLowerCase();
	name = name.replace(/[^a-z0-9.-]+/g, "-");
	name = name.replace(/-{2,}/g, "-").replace(/\.{2,}/g, ".");
	name = name.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
	if (name.length > 64) {
		name = name.slice(0, 64).replace(/[^a-z0-9]+$/g, "");
	}
	if (!PLUGIN_NAME_PATTERN.test(name)) {
		throw new Error(
			`cannot derive a valid Agent Plugins name from ${JSON.stringify(raw)}`,
		);
	}
	return name;
}

export function parseCursorManifest(value: unknown): CursorPluginManifest {
	if (!isJsonObject(value)) {
		throw new Error("plugin.json must be a JSON object");
	}
	const name = optionalString(value.name);
	if (!name) {
		throw new Error("plugin.json is missing a string name");
	}
	return value as CursorPluginManifest;
}

export function convertManifest(cursor: CursorPluginManifest): {
	manifest: AgentPluginManifest;
	extension: JsonObject;
	inlineHooks: JsonObject | undefined;
	warnings: string[];
} {
	const warnings: string[] = [];
	const name = toPluginName(cursor.name);
	if (name !== cursor.name) {
		warnings.push(`renamed plugin ${JSON.stringify(cursor.name)} → ${name}`);
	}

	const manifest: AgentPluginManifest = {
		$schema: PLUGIN_SCHEMA,
		name,
	};

	const version = optionalString(cursor.version);
	if (version) {
		manifest.version = version;
	}
	const description = optionalString(cursor.description);
	if (description) {
		manifest.description = description;
	}
	const author = convertAuthor(cursor.author);
	if (author) {
		manifest.author = author;
	}
	const homepage = optionalString(cursor.homepage);
	if (homepage) {
		manifest.homepage = homepage;
	}
	const repository = optionalString(cursor.repository);
	if (repository) {
		manifest.repository = repository;
	}
	const license = optionalString(cursor.license);
	if (license) {
		manifest.license = license;
	}
	if (Array.isArray(cursor.keywords) && cursor.keywords.every(isString)) {
		manifest.keywords = cursor.keywords;
	}

	const { extension, inlineHooks } = buildCursorExtension(cursor);
	return { manifest, extension, inlineHooks, warnings };
}

export function attachExtensions(
	manifest: AgentPluginManifest,
	extensions: Record<string, JsonObject>,
): AgentPluginManifest {
	const present: Record<string, JsonObject> = {};
	for (const [namespace, value] of Object.entries(extensions)) {
		if (Object.keys(value).length > 0) {
			present[namespace] = value;
		}
	}
	if (Object.keys(present).length === 0) {
		return manifest;
	}
	return {
		...manifest,
		extensions: present,
	};
}

const CURSOR_COMPONENT_DIR_SET = new Set<string>(CURSOR_COMPONENT_DIRS);

export function relocateCursorPath(path: string): string {
	const trimmed = path.trim();
	const withoutDot = trimmed.replace(/^\.\//, "");
	const top = withoutDot.split(/[\\/]/)[0];
	if (top && CURSOR_COMPONENT_DIR_SET.has(top)) {
		return `./${CURSOR_EXTENSION}/${withoutDot}`;
	}
	return trimmed.startsWith("./") ? trimmed : `./${withoutDot}`;
}

function buildCursorExtension(cursor: CursorPluginManifest): {
	extension: JsonObject;
	inlineHooks: JsonObject | undefined;
} {
	const extension: JsonObject = {};

	for (const key of CURSOR_SCALAR_KEYS) {
		const value = optionalString(cursor[key]);
		if (value) {
			extension[key] = value;
		}
	}

	if (Array.isArray(cursor.tags) && cursor.tags.every(isString)) {
		extension.tags = cursor.tags;
	}

	for (const key of CURSOR_OBJECT_KEYS) {
		const value = cursor[key];
		if (isJsonObject(value)) {
			extension[key] = value;
		}
	}

	for (const key of ["commands", "agents", "rules"] as const) {
		const relocated = relocateMaybePaths(cursor[key]);
		if (relocated) {
			extension[key] = relocated;
		}
	}

	let inlineHooks: JsonObject | undefined;
	if (typeof cursor.hooks === "string") {
		extension.hooks = relocateCursorPath(cursor.hooks);
	} else if (isJsonObject(cursor.hooks)) {
		inlineHooks = cursor.hooks;
		extension.hooks = `./${CURSOR_EXTENSION}/hooks/hooks.json`;
	}

	for (const key of Object.keys(cursor)) {
		if (
			PORTABLE_KEYS.has(key) ||
			CURSOR_SCALAR_KEYS.includes(key as (typeof CURSOR_SCALAR_KEYS)[number]) ||
			CURSOR_OBJECT_KEYS.includes(key as (typeof CURSOR_OBJECT_KEYS)[number]) ||
			key === "tags" ||
			key === "commands" ||
			key === "agents" ||
			key === "rules" ||
			key === "hooks" ||
			key === "skills" ||
			key === "mcpServers"
		) {
			continue;
		}
		const value = (cursor as JsonObject)[key];
		if (isJsonObject(value) || Array.isArray(value) || isString(value)) {
			extension[key] = value;
		}
	}

	return { extension, inlineHooks };
}

function convertAuthor(value: unknown): AgentAuthor | undefined {
	if (!isJsonObject(value)) {
		return undefined;
	}
	const author: AgentAuthor = {};
	const name = optionalString(value.name);
	if (name) {
		author.name = name;
	}
	const email = optionalString(value.email);
	if (email) {
		author.email = email;
	}
	const url = optionalString(value.url);
	if (url) {
		author.url = url;
	}
	return Object.keys(author).length > 0 ? author : undefined;
}

function relocateMaybePaths(
	value: string | string[] | undefined,
): string | string[] | undefined {
	if (typeof value === "string") {
		return relocateCursorPath(value);
	}
	if (Array.isArray(value) && value.every(isString)) {
		return value.map(relocateCursorPath);
	}
	return undefined;
}

function optionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}
