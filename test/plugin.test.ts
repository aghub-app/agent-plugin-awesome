import { afterEach, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CURSOR_PLUGINS_REPO } from "../src/aghub.ts";
import { placeholder } from "../src/placeholder.ts";
import { convertAll, convertPlugin } from "../src/plugin.ts";
import { AGHUB_EXTENSION, MCP_SCHEMA, PLUGIN_SCHEMA } from "../src/types.ts";

const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("converts a Cursor plugin into the Agent Plugins layout", () => {
	const root = mkdtempSync(join(tmpdir(), "cursor-plugin-"));
	dirs.push(root);
	const source = join(root, "demo");
	const out = join(root, "out");

	mkdirSync(join(source, ".cursor-plugin"), { recursive: true });
	mkdirSync(join(source, "skills", "greet"), { recursive: true });
	mkdirSync(join(source, "rules"), { recursive: true });
	mkdirSync(join(source, "assets"), { recursive: true });
	writeFileSync(
		join(source, ".cursor-plugin", "plugin.json"),
		JSON.stringify({
			name: "demo",
			displayName: "Demo",
			version: "1.2.0",
			description: "A fixture plugin",
			author: { name: "Cursor" },
			logo: "assets/logo.svg",
			category: "developer-tools",
			skills: "./skills/",
			rules: "./rules/",
			mcpServers: "./mcp.json",
		}),
	);
	writeFileSync(join(source, "skills", "greet", "SKILL.md"), "# greet\n");
	writeFileSync(join(source, "rules", "style.mdc"), "# style\n");
	writeFileSync(join(source, "assets", "logo.svg"), "<svg />\n");
	writeFileSync(join(source, "LICENSE"), "MIT\n");
	writeFileSync(
		join(source, "mcp.json"),
		JSON.stringify({
			mcpServers: {
				github: {
					type: "http",
					url: "https://example.com/mcp",
					headers: { Authorization: `Bearer ${placeholder("TOKEN")}` },
				},
			},
		}),
	);

	const result = convertPlugin(source, out, { sourceRoot: root });
	const dest = join(out, "demo");

	expect(result.name).toBe("demo");
	expect(existsSync(join(dest, ".cursor-plugin"))).toBe(false);
	expect(readJson(join(dest, "plugin.json"))).toEqual({
		$schema: PLUGIN_SCHEMA,
		name: "demo",
		version: "1.2.0",
		description: "A fixture plugin",
		author: { name: "Cursor" },
		extensions: {
			"com.cursor": {
				displayName: "Demo",
				logo: "assets/logo.svg",
				category: "developer-tools",
				rules: "./com.cursor/rules/",
				mcpServers: {
					github: {
						headers: { Authorization: `Bearer ${placeholder("TOKEN")}` },
					},
				},
			},
			[AGHUB_EXTENSION]: {
				category: "Developer tools",
				source: {
					repo: CURSOR_PLUGINS_REPO,
					path: "demo",
				},
			},
		},
	});
	expect(readJson(join(dest, "mcp.json"))).toEqual({
		$schema: MCP_SCHEMA,
		mcpServers: {
			github: {
				type: "streamable-http",
				url: "https://example.com/mcp",
			},
		},
	});
	expect(readFileSync(join(dest, "skills", "greet", "SKILL.md"), "utf8")).toBe(
		"# greet\n",
	);
	expect(
		readFileSync(join(dest, "com.cursor", "rules", "style.mdc"), "utf8"),
	).toBe("# style\n");
	expect(readFileSync(join(dest, "assets", "logo.svg"), "utf8")).toBe(
		"<svg />\n",
	);
	expect(readFileSync(join(dest, "LICENSE"), "utf8")).toBe("MIT\n");
});

test("convertAll writes every discovered plugin and reports a missing source", () => {
	const root = mkdtempSync(join(tmpdir(), "cursor-all-"));
	dirs.push(root);
	writeMinimalPlugin(join(root, "source", "one"), "one", "utilities");
	writeMinimalPlugin(
		join(root, "source", "nested", "two"),
		"two",
		"integrations",
	);

	const { converted, failures } = convertAll(
		join(root, "source"),
		join(root, "out"),
	);
	expect(failures).toEqual([]);
	expect(converted.map((item) => item.name).sort()).toEqual(["one", "two"]);
	expect(existsSync(join(root, "out", "one", "plugin.json"))).toBe(true);
	expect(readJson(join(root, "out", "two", "plugin.json"))).toMatchObject({
		extensions: {
			[AGHUB_EXTENSION]: {
				category: "Integrations",
				source: {
					repo: CURSOR_PLUGINS_REPO,
					path: "nested/two",
				},
			},
		},
	});

	expect(() => convertAll(join(root, "missing"), join(root, "out"))).toThrow(
		/submodule/,
	);
});

function writeMinimalPlugin(dir: string, name: string, category: string): void {
	mkdirSync(join(dir, ".cursor-plugin"), { recursive: true });
	writeFileSync(
		join(dir, ".cursor-plugin", "plugin.json"),
		JSON.stringify({ name, description: name, category }),
	);
}

function readJson(path: string): unknown {
	return JSON.parse(readFileSync(path, "utf8")) as unknown;
}
