import { describe, expect, it } from "vitest";
import { add, echo, slugify, textStats, tools } from "../src/tools.js";

describe("echo", () => {
  it("returns the input unchanged", () => {
    expect(echo("hello")).toBe("hello");
  });
});

describe("add", () => {
  it("adds two numbers", () => {
    expect(add(2, 3)).toBe(5);
  });

  it("handles negatives", () => {
    expect(add(-4, 1.5)).toBe(-2.5);
  });
});

describe("textStats", () => {
  it("counts characters, words, and lines", () => {
    expect(textStats("hello world\nfoo")).toEqual({
      characters: 15,
      words: 3,
      lines: 2,
    });
  });

  it("handles empty input", () => {
    expect(textStats("")).toEqual({ characters: 0, words: 0, lines: 0 });
  });
});

describe("slugify", () => {
  it("produces a url-friendly slug", () => {
    expect(slugify("  Hello, World!  ")).toBe("hello-world");
  });

  it("strips accents", () => {
    expect(slugify("Café déjà vu")).toBe("cafe-deja-vu");
  });
});

describe("tools catalogue", () => {
  it("exposes the expected tool names", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "add",
      "echo",
      "slugify",
      "text_stats",
    ]);
  });
});
