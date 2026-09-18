import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pluginIndexEntry } from "../src/catalog.ts";
import { placeholder } from "../src/placeholder.ts";
import { AGHUB_EXTENSION, PLUGIN_SCHEMA } from "../src/types.ts";

const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("indexes portable metadata, aghub category/source, skills, and MCP servers", () => {
	const root = mkdtempSync(join(tmpdir(), "plugin-index-"));
	dirs.push(root);
	const pluginDir = join(root, "github");
	mkdirSync(join(pluginDir, "skills", "github-review"), { recursive: true });
	mkdirSync(join(pluginDir, "skills", "empty"), { recursive: true });
	writeFileSync(join(pluginDir, "skills", "github-review", "SKILL.md"), "#\n");
	writeFileSync(
		join(pluginDir, "plugin.json"),
		JSON.stringify({
			$schema: PLUGIN_SCHEMA,
			name: "github",
			version: "1.0.0",
			description: "Manage repos",
			author: { name: "Cursor", email: "plugins@cursor.com" },
			license: "MIT",
			keywords: ["github"],
			extensions: {
				"com.cursor": {
					displayName: "GitHub",
					logo: "assets/logo.svg",
				},
				[AGHUB_EXTENSION]: {
					category: "Integrations",
					source: {
						repo: "https://github.com/cursor/plugins",
						path: "third_party/github",
					},
				},
			},
		}),
	);
	writeFileSync(
		join(pluginDir, "mcp.json"),
		JSON.stringify({
			mcpServers: {
				github: {
					type: "streamable-http",
					url: "https://example.com/mcp",
					headers: {
						Authorization: `Bearer ${placeholder("TOKEN")}`,
					},
				},
			},
		}),
	);

	expect(pluginIndexEntry(pluginDir, "github")).toEqual({
		name: "github",
		path: "github",
		version: "1.0.0",
		description: "Manage repos",
		author: { name: "Cursor", email: "plugins@cursor.com" },
		license: "MIT",
		keywords: ["github"],
		displayName: "GitHub",
		logo: "assets/logo.svg",
		category: "Integrations",
		source: {
			repo: "https://github.com/cursor/plugins",
			path: "third_party/github",
		},
		skills: ["github-review"],
		mcpServers: ["github"],
	});
});
