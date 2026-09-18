import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanCursorPlugins } from "../src/scan.ts";

const dirs: string[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("finds nested .cursor-plugin/plugin.json roots and skips node_modules", () => {
	const root = mkdtempSync(join(tmpdir(), "cursor-scan-"));
	dirs.push(root);

	writePlugin(join(root, "ralph-loop"));
	writePlugin(join(root, "third_party", "github"));
	writePlugin(join(root, "node_modules", "ignored"));
	mkdirSync(join(root, ".cursor-plugin"), { recursive: true });
	writeFileSync(
		join(root, ".cursor-plugin", "marketplace.json"),
		JSON.stringify({ name: "cursor-plugins" }),
	);

	expect(scanCursorPlugins(root)).toEqual([
		join(root, "ralph-loop"),
		join(root, "third_party", "github"),
	]);
});

function writePlugin(dir: string): void {
	mkdirSync(join(dir, ".cursor-plugin"), { recursive: true });
	writeFileSync(
		join(dir, ".cursor-plugin", "plugin.json"),
		JSON.stringify({ name: "demo" }),
	);
}
