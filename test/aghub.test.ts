import { expect, test } from "bun:test";
import {
	AGHUB_CATEGORIES,
	buildAghubExtension,
	mapAghubCategory,
	pluginSourcePath,
} from "../src/aghub.ts";
import { AGHUB_EXTENSION } from "../src/types.ts";

test("maps Cursor category slugs onto the aghub catalog", () => {
	expect(mapAghubCategory("utilities")).toBe("Utilities");
	expect(mapAghubCategory("developer-tools")).toBe("Developer tools");
	expect(mapAghubCategory("Developer tools")).toBe("Developer tools");
	expect(mapAghubCategory("productivity")).toBe("Productivity");
	expect(mapAghubCategory("integrations")).toBe("Integrations");
	expect(mapAghubCategory("unknown")).toBeUndefined();
	expect(mapAghubCategory(undefined)).toBeUndefined();
});

test("builds moe.akr.aghub with category and source repo/path", () => {
	const { extension, warnings } = buildAghubExtension({
		category: "developer-tools",
		repo: "https://github.com/cursor/plugins",
		path: "ralph-loop",
	});

	expect(warnings).toEqual([]);
	expect(extension).toEqual({
		category: "Developer tools",
		source: {
			repo: "https://github.com/cursor/plugins",
			path: "ralph-loop",
		},
	});
});

test("warns when the Cursor category is missing or outside the catalog", () => {
	expect(
		buildAghubExtension({ repo: "https://example.com", path: "x" }).warnings,
	).toEqual([`missing category for ${AGHUB_EXTENSION}`]);
	expect(
		buildAghubExtension({
			category: "experimental",
			repo: "https://example.com",
			path: "x",
		}).warnings[0],
	).toContain(AGHUB_CATEGORIES.join(", "));
});

test("records a posix path relative to the source root", () => {
	expect(pluginSourcePath("/repo", "/repo/third_party/github")).toBe(
		"third_party/github",
	);
	expect(() => pluginSourcePath("/repo", "/other")).toThrow(
		/outside source root/,
	);
});
