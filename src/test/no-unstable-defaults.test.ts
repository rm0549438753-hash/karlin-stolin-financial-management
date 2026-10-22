import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// `const { data = [] } = useQuery(...)` creates a new array every render and
// caused repeated "Maximum update depth exceeded" crashes. Use EMPTY_ARRAY.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "integrations" ? [] : walk(p);
    return /\.tsx?$/.test(n) && !n.endsWith(".test.ts") ? [p] : [];
  });
}

describe("unstable query defaults", () => {
  it("no `data = []` / `data = {}` defaults in source", () => {
    const bad: string[] = [];
    for (const f of walk("src")) {
      readFileSync(f, "utf8").split("\n").forEach((l, i) => {
        if (!/^\s*(\/\/|\*)/.test(l) && /\bdata(?::\s*\w+)?\s*=\s*(\[\]|\{\})/.test(l)) bad.push(`${f}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
