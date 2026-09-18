import { relative, resolve, sep } from "node:path";
import { AGHUB_EXTENSION, type JsonObject } from "./types.ts";

export { AGHUB_EXTENSION } from "./types.ts";
export const CURSOR_PLUGINS_REPO = "https://github.com/cursor/plugins";

export const AGHUB_CATEGORIES = [
	"Utilities",
	"Developer tools",
	"Productivity",
	"Integrations",
] as const;

export type AghubCategory = (typeof AGHUB_CATEGORIES)[number];

const CATEGORY_BY_SLUG: Record<string, AghubCategory> = {
	utilities: "Utilities",
	"developer-tools": "Developer tools",
	"developer tools": "Developer tools",
	productivity: "Productivity",
	integrations: "Integrations",
};

export type AghubSource = {
	repo: string;
	path: string;
};

export function mapAghubCategory(
	raw: string | undefined,
): AghubCategory | undefined {
	if (!raw) {
		return undefined;
	}
	const exact = AGHUB_CATEGORIES.find((category) => category === raw);
	if (exact) {
		return exact;
	}
	return CATEGORY_BY_SLUG[raw.trim().toLowerCase()];
}

export function pluginSourcePath(
	sourceRoot: string,
	pluginDir: string,
): string {
	const relativePath = relative(resolve(sourceRoot), resolve(pluginDir));
	if (!relativePath || relativePath === ".") {
		return ".";
	}
	if (relativePath.startsWith("..")) {
		throw new Error(`plugin ${pluginDir} is outside source root ${sourceRoot}`);
	}
	return relativePath.split(sep).join("/");
}

export function buildAghubExtension(input: {
	category?: string;
	repo: string;
	path: string;
}): { extension: JsonObject; warnings: string[] } {
	const warnings: string[] = [];
	const category = mapAghubCategory(input.category);
	if (!category && input.category) {
		warnings.push(
			`unmapped category ${JSON.stringify(input.category)}; expected one of ${AGHUB_CATEGORIES.join(", ")}`,
		);
	} else if (!category) {
		warnings.push(`missing category for ${AGHUB_EXTENSION}`);
	}

	const extension: JsonObject = {};
	if (category) {
		extension.category = category;
	}
	extension.source = {
		repo: input.repo,
		path: input.path,
	} satisfies AghubSource;

	return { extension, warnings };
}
