import { type Dirent, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SKIP_DIR_NAMES = new Set([".git", "node_modules", "out", "dist"]);

export function scanCursorPlugins(root: string): string[] {
	const found: string[] = [];
	walk(root, found);
	return found.sort();
}

function walk(dir: string, found: string[]): void {
	let entries: Dirent[];
	try {
		entries = readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		if (!entry.isDirectory() || SKIP_DIR_NAMES.has(entry.name)) {
			continue;
		}

		const full = join(dir, entry.name);
		if (entry.name === ".cursor-plugin") {
			if (existsSync(join(full, "plugin.json"))) {
				found.push(dir);
			}
			continue;
		}

		walk(full, found);
	}
}
