import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { readJsonFile, writeJsonFile } from "./io.ts";
import {
	AGHUB_EXTENSION,
	type AgentAuthor,
	type ConvertResult,
	CURSOR_EXTENSION,
	isJsonObject,
} from "./types.ts";

export type PluginIndexEntry = {
	name: string;
	path: string;
	version?: string;
	description?: string;
	author?: AgentAuthor;
	homepage?: string;
	repository?: string;
	license?: string;
	keywords?: string[];
	displayName?: string;
	logo?: string;
	category?: string;
	source?: {
		repo: string;
		path: string;
	};
	skills: string[];
	mcpServers: string[];
};

export type PluginIndex = {
	plugins: PluginIndexEntry[];
};

export function writePluginIndex(
	outRoot: string,
	converted: ConvertResult[],
): PluginIndex {
	const plugins = converted
		.map((item) =>
			pluginIndexEntry(item.output, posixRelative(outRoot, item.output)),
		)
		.sort((left, right) => left.name.localeCompare(right.name));
	const index: PluginIndex = { plugins };
	writeJsonFile(join(outRoot, "all.json"), index);
	return index;
}

export function pluginIndexEntry(
	pluginDir: string,
	path: string,
): PluginIndexEntry {
	const manifest = readJsonFile(join(pluginDir, "plugin.json"));
	if (!isJsonObject(manifest)) {
		throw new Error(`plugin.json in ${pluginDir} must be an object`);
	}

	const name = optionalString(manifest.name);
	if (!name) {
		throw new Error(`plugin.json in ${pluginDir} is missing a string name`);
	}

	const extensions = isJsonObject(manifest.extensions)
		? manifest.extensions
		: {};
	const cursor = isJsonObject(extensions[CURSOR_EXTENSION])
		? extensions[CURSOR_EXTENSION]
		: {};
	const aghub = isJsonObject(extensions[AGHUB_EXTENSION])
		? extensions[AGHUB_EXTENSION]
		: {};

	const keywords =
		Array.isArray(manifest.keywords) &&
		manifest.keywords.every((item) => typeof item === "string")
			? manifest.keywords
			: undefined;

	return {
		name,
		path,
		...optionalField("version", optionalString(manifest.version)),
		...optionalField("description", optionalString(manifest.description)),
		...optionalField("author", convertAuthor(manifest.author)),
		...optionalField("homepage", optionalString(manifest.homepage)),
		...optionalField("repository", optionalString(manifest.repository)),
		...optionalField("license", optionalString(manifest.license)),
		...optionalField("keywords", keywords),
		...optionalField("displayName", optionalString(cursor.displayName)),
		...optionalField("logo", optionalString(cursor.logo)),
		...optionalField("category", optionalString(aghub.category)),
		...optionalField("source", convertSource(aghub.source)),
		skills: listSkills(pluginDir),
		mcpServers: listMcpServers(pluginDir),
	};
}

function optionalField<K extends string, V>(
	key: K,
	value: V | undefined,
): Partial<Record<K, V>> {
	return value === undefined ? {} : ({ [key]: value } as Partial<Record<K, V>>);
}

function listSkills(pluginDir: string): string[] {
	const skillsDir = join(pluginDir, "skills");
	if (!existsSync(skillsDir) || !statSync(skillsDir).isDirectory()) {
		return [];
	}
	return readdirSync(skillsDir, { withFileTypes: true })
		.filter(
			(entry) =>
				entry.isDirectory() &&
				existsSync(join(skillsDir, entry.name, "SKILL.md")),
		)
		.map((entry) => entry.name)
		.sort();
}

function listMcpServers(pluginDir: string): string[] {
	const mcpPath = join(pluginDir, "mcp.json");
	if (!existsSync(mcpPath)) {
		return [];
	}
	const mcp = readJsonFile(mcpPath);
	if (!isJsonObject(mcp) || !isJsonObject(mcp.mcpServers)) {
		return [];
	}
	return Object.keys(mcp.mcpServers).sort();
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

function convertSource(
	value: unknown,
): { repo: string; path: string } | undefined {
	if (!isJsonObject(value)) {
		return undefined;
	}
	const repo = optionalString(value.repo);
	const path = optionalString(value.path);
	if (!repo || !path) {
		return undefined;
	}
	return { repo, path };
}

function posixRelative(from: string, to: string): string {
	return relative(from, to).split(sep).join("/");
}

function optionalString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}
