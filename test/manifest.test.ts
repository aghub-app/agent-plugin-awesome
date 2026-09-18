import { expect, test } from "bun:test";
import {
	attachExtensions,
	convertManifest,
	relocateCursorPath,
	toPluginName,
} from "../src/manifest.ts";
import { CURSOR_EXTENSION, PLUGIN_SCHEMA } from "../src/types.ts";

test("keeps a valid Agent Plugins name unchanged", () => {
	expect(toPluginName("github")).toBe("github");
	expect(toPluginName("acme.tools")).toBe("acme.tools");
});

test("sanitizes a display-style name into the Agent Plugins charset", () => {
	expect(toPluginName("My Plugin")).toBe("my-plugin");
});

test("rejects a name that cannot be made valid", () => {
	expect(() => toPluginName("---")).toThrow(/cannot derive/);
});

test("moves Cursor-only manifest fields under com.cursor", () => {
	const { manifest, extension } = convertManifest({
		name: "ralph-loop",
		displayName: "Ralph Loop",
		version: "1.0.0",
		description: "Iterative loops",
		author: { name: "Cursor", email: "plugins@cursor.com" },
		homepage: "https://github.com/cursor/plugins",
		repository: "https://github.com/cursor/plugins",
		license: "MIT",
		logo: "assets/avatar.png",
		keywords: ["ralph"],
		category: "developer-tools",
		tags: ["automation"],
		hooks: "./hooks/hooks.json",
		skills: "./skills/",
		mcpServers: "./mcp.json",
	});

	expect(manifest).toEqual({
		$schema: PLUGIN_SCHEMA,
		name: "ralph-loop",
		version: "1.0.0",
		description: "Iterative loops",
		author: { name: "Cursor", email: "plugins@cursor.com" },
		homepage: "https://github.com/cursor/plugins",
		repository: "https://github.com/cursor/plugins",
		license: "MIT",
		keywords: ["ralph"],
	});
	expect(extension).toEqual({
		displayName: "Ralph Loop",
		logo: "assets/avatar.png",
		category: "developer-tools",
		tags: ["automation"],
		hooks: "./com.cursor/hooks/hooks.json",
	});
	expect(
		attachExtensions(manifest, { [CURSOR_EXTENSION]: extension }).extensions,
	).toEqual({
		[CURSOR_EXTENSION]: extension,
	});
});

test("rewrites Cursor component paths into the com.cursor directory", () => {
	expect(relocateCursorPath("./rules/")).toBe("./com.cursor/rules/");
	expect(relocateCursorPath("./agents/reviewer.md")).toBe(
		"./com.cursor/agents/reviewer.md",
	);
	expect(relocateCursorPath("./assets/logo.svg")).toBe("./assets/logo.svg");
});

test("omits an empty extensions object", () => {
	const { manifest, extension } = convertManifest({
		name: "cli-for-agent",
		description: "CLI patterns",
	});
	expect(extension).toEqual({});
	expect(
		attachExtensions(manifest, { [CURSOR_EXTENSION]: extension }).extensions,
	).toBeUndefined();
});
