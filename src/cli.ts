import { parseArgs } from "node:util";
import { CURSOR_PLUGINS_REPO } from "./aghub.ts";
import { convertAll } from "./plugin.ts";

const { values } = parseArgs({
	args: Bun.argv.slice(2),
	options: {
		source: { type: "string", default: "vendor/cursor-plugins" },
		out: { type: "string", default: "out" },
		repo: { type: "string", default: CURSOR_PLUGINS_REPO },
	},
	strict: true,
});

const source = values.source ?? "vendor/cursor-plugins";
const out = values.out ?? "out";
const { converted, failures } = convertAll(source, out, {
	repo: values.repo ?? CURSOR_PLUGINS_REPO,
});
const nameWidth = converted.reduce(
	(width, item) => Math.max(width, item.name.length),
	0,
);

for (const result of converted) {
	const parts = [
		result.hasSkills ? "skills" : undefined,
		result.mcpServers.length > 0
			? `mcp:${result.mcpServers.join(",")}`
			: undefined,
		result.cursorComponents.length > 0
			? `cursor:${result.cursorComponents.join(",")}`
			: undefined,
	].filter((part): part is string => part !== undefined);

	console.log(
		`${result.name.padEnd(nameWidth)}  ${parts.join("  ") || "empty"}`,
	);
	for (const warning of result.warnings) {
		console.warn(`  warn: ${warning}`);
	}
}

for (const failure of failures) {
	console.error(`FAIL ${failure.source}: ${failure.error}`);
}

console.log(
	`\nconverted ${converted.length} plugin(s) → ${out}` +
		(failures.length > 0 ? `, ${failures.length} failed` : "") +
		`\nwrote ${out}/all.json`,
);

if (failures.length > 0) {
	process.exitCode = 1;
}
