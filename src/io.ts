import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function readJsonFile(path: string): unknown {
	const text = readFileSync(path, "utf8");
	try {
		return JSON.parse(text) as unknown;
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new Error(`invalid JSON in ${path}: ${reason}`);
	}
}

export function writeJsonFile(path: string, value: unknown): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}
