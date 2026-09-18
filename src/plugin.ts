import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	rmSync,
	statSync,
} from "node:fs";
import { join } from "node:path";
import {
	AGHUB_EXTENSION,
	buildAghubExtension,
	CURSOR_PLUGINS_REPO,
	pluginSourcePath,
} from "./aghub.ts";
import { writePluginIndex } from "./catalog.ts";
import { readJsonFile, writeJsonFile } from "./io.ts";
import {
	attachExtensions,
	convertManifest,
	parseCursorManifest,
	toPluginName,
} from "./manifest.ts";
import { convertPluginMcp } from "./mcp.ts";
import { scanCursorPlugins } from "./scan.ts";
import {
	type ConvertResult,
	CURSOR_COMPONENT_DIRS,
	CURSOR_EXTENSION,
	isJsonObject,
} from "./types.ts";

const SKIP_COPY_NAMES = new Set([
	".cursor-plugin",
	".git",
	"node_modules",
	"mcp.json",
	".DS_Store",
]);

export type ConvertOptions = {
	sourceRoot: string;
	repo?: string;
};

export type ConvertAllResult = {
	converted: ConvertResult[];
	failures: Array<{ source: string; error: string }>;
};

export function convertAll(
	sourceRoot: string,
	outRoot: string,
	options: Pick<ConvertOptions, "repo"> = {},
): ConvertAllResult {
	if (!existsSync(sourceRoot)) {
		throw new Error(
			`source not found: ${sourceRoot}\nDid you run git submodule update --init?`,
		);
	}

	rmSync(outRoot, { recursive: true, force: true });
	mkdirSync(outRoot, { recursive: true });

	const converted: ConvertResult[] = [];
	const failures: Array<{ source: string; error: string }> = [];
	const usedNames = new Map<string, string>();

	for (const source of scanCursorPlugins(sourceRoot)) {
		try {
			const name = peekPluginName(source);
			const previous = usedNames.get(name);
			if (previous) {
				throw new Error(
					`duplicate plugin name ${name} from ${previous} and ${source}`,
				);
			}
			usedNames.set(name, source);
			converted.push(
				convertPlugin(source, outRoot, {
					sourceRoot,
					repo: options.repo,
				}),
			);
		} catch (error) {
			failures.push({
				source,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	writePluginIndex(outRoot, converted);
	return { converted, failures };
}

export function convertPlugin(
	sourceDir: string,
	outRoot: string,
	options: ConvertOptions,
): ConvertResult {
	const cursor = parseCursorManifest(
		readJsonFile(join(sourceDir, ".cursor-plugin", "plugin.json")),
	);
	const { manifest, extension, inlineHooks, warnings } =
		convertManifest(cursor);
	const mcp = convertPluginMcp(sourceDir, cursor);
	warnings.push(...mcp.warnings);

	if (Object.keys(mcp.cursorExtras).length > 0) {
		extension.mcpServers = mcp.cursorExtras;
	}

	const aghub = buildAghubExtension({
		category: cursor.category,
		repo: options.repo ?? CURSOR_PLUGINS_REPO,
		path: pluginSourcePath(options.sourceRoot, sourceDir),
	});
	warnings.push(...aghub.warnings);

	const dest = join(outRoot, manifest.name);
	rmSync(dest, { recursive: true, force: true });
	mkdirSync(dest, { recursive: true });
	const cursorComponents = copyPluginFiles(sourceDir, dest);

	if (inlineHooks) {
		writeJsonFile(
			join(dest, CURSOR_EXTENSION, "hooks", "hooks.json"),
			inlineHooks,
		);
		if (!cursorComponents.includes("hooks")) {
			cursorComponents.push("hooks");
		}
	}

	writeJsonFile(
		join(dest, "plugin.json"),
		attachExtensions(manifest, {
			[CURSOR_EXTENSION]: extension,
			[AGHUB_EXTENSION]: aghub.extension,
		}),
	);
	if (mcp.mcp) {
		writeJsonFile(join(dest, "mcp.json"), mcp.mcp);
	}

	return {
		name: manifest.name,
		source: sourceDir,
		output: dest,
		warnings,
		hasSkills: existsSync(join(dest, "skills")),
		mcpServers: mcp.mcp ? Object.keys(mcp.mcp.mcpServers) : [],
		cursorComponents: cursorComponents.sort(),
	};
}

function copyPluginFiles(sourceDir: string, destDir: string): string[] {
	const cursorComponents: string[] = [];
	for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
		if (SKIP_COPY_NAMES.has(entry.name)) {
			continue;
		}

		const from = join(sourceDir, entry.name);
		const isCursorComponent = isCursorComponentDir(entry.name);
		const to = isCursorComponent
			? join(destDir, CURSOR_EXTENSION, entry.name)
			: join(destDir, entry.name);

		if (entry.isDirectory() || entry.isFile()) {
			cpSync(from, to, { recursive: true });
		}

		if (isCursorComponent) {
			cursorComponents.push(entry.name);
		}
	}

	copySkillsFromManifest(sourceDir, destDir);
	return cursorComponents;
}

function copySkillsFromManifest(sourceDir: string, destDir: string): void {
	const destSkills = join(destDir, "skills");
	if (existsSync(destSkills)) {
		return;
	}

	const manifestPath = join(sourceDir, ".cursor-plugin", "plugin.json");
	const raw = readJsonFile(manifestPath);
	if (!isJsonObject(raw) || raw.skills === undefined) {
		return;
	}

	const skillPath = Array.isArray(raw.skills) ? raw.skills[0] : raw.skills;
	if (typeof skillPath !== "string") {
		return;
	}

	const from = join(sourceDir, skillPath.replace(/^\.\//, ""));
	if (!existsSync(from) || !statSync(from).isDirectory()) {
		return;
	}
	cpSync(from, destSkills, { recursive: true });
}

function peekPluginName(sourceDir: string): string {
	const cursor = parseCursorManifest(
		readJsonFile(join(sourceDir, ".cursor-plugin", "plugin.json")),
	);
	return toPluginName(cursor.name);
}

const CURSOR_COMPONENT_DIR_SET = new Set<string>(CURSOR_COMPONENT_DIRS);

function isCursorComponentDir(name: string): boolean {
	return CURSOR_COMPONENT_DIR_SET.has(name);
}
