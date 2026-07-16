import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Word } from "../data/types";
import { eligibleParticipleVerbs, participleFor } from "./participle";
import expected from "./participle.expected.json";

/**
 * Corpus audit: every eligible verb in the book must resolve to the
 * hand-audited participle in participle.expected.json (format:
 * "[is |(is) ]<participle>[ *]" — the trailing * marks irregular).
 *
 * This test is the safety net for the derivation rules AND for book
 * re-ingestion: if a future ingest run changes/adds verbs, this diffs loudly.
 * When a NEW verb legitimately appears, derive it, verify the form in a
 * dictionary, and add it here (fix data/participle-overrides.json if the
 * derivation is wrong — never edit chapter JSONs, they get regenerated).
 */
const dir = join(__dirname, "../data/chapters");
const files = readdirSync(dir)
  .filter((f) => /^hoofdstuk-\d+\.json$/.test(f))
  .sort();
const verbs = files.flatMap((f) =>
  eligibleParticipleVerbs(JSON.parse(readFileSync(join(dir, f), "utf8")) as Word[]),
);

const render = (w: Word): string => {
  const info = participleFor(w)!;
  const aux = info.aux === "zijn" ? "is " : info.aux === "beide" ? "(is) " : "";
  return `${aux}${info.participle}${info.irregular ? " *" : ""}`;
};

describe("participle corpus", () => {
  it("covers every expected verb (none dropped by eligibility)", () => {
    expect(new Set(verbs.map((w) => w.id))).toEqual(new Set(Object.keys(expected)));
  });

  it.each(verbs.map((w) => [w.id, w] as const))("%s", (id, w) => {
    expect(render(w)).toBe((expected as Record<string, string>)[id]);
  });

  it("regular verbs always carry the build-up parts", () => {
    for (const w of verbs) {
      const info = participleFor(w)!;
      if (!info.irregular) {
        expect(info.parts, w.id).toBeDefined();
        expect(info.parts!.join(""), w.id).toBe(
          info.participle.replace("geë", "gee").replace("geï", "gei"),
        );
      }
    }
  });
});
