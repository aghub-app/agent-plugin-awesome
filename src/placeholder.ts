export function placeholder(name: string): string {
	return ["$", "{", name, "}"].join("");
}
