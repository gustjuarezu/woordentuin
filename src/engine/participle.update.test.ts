import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Word } from "../data/types";
import { eligibleParticipleVerbs, participleFor } from "./participle";
import expected from "./participle.expected.json";

/**
 * Corpus updater (run with UPDATE_PP_EXPECTED=1 npx vitest run participle.update):
 * appends newly ingested verbs to participle.expected.json and drops verbs that
 * no longer exist, leaving existing hand-audited entries untouched. New entries
 * carry the CURRENT derivation — audit them (dictionary-check irregulars/aux)
 * before committing; the corpus test only guards against future drift.
 * Without the env var this file just asserts the corpus is in sync.
 */
const levelsDir = join(__dirname, "../data/levels");
const verbs = readdirSync(levelsDir)
  .flatMap((lvl) =>
    readdirSync(join(levelsDir, lvl))
      .filter((f) => /^hoofdstuk-\d+\.json$/.test(f))
      .map((f) => join(levelsDir, lvl, f)),
  )
  .sort()
  .flatMap((f) => eligibleParticipleVerbs(JSON.parse(readFileSync(f, "utf8")) as Word[]));

const render = (w: Word): string => {
  const info = participleFor(w)!;
  const aux = info.aux === "zijn" ? "is " : info.aux === "beide" ? "(is) " : "";
  return `${aux}${info.participle}${info.irregular ? " *" : ""}`;
};

describe("participle corpus sync", () => {
  it("expected.json covers exactly the eligible verbs", () => {
    const current = expected as Record<string, string>;
    const ids = new Set(verbs.map((w) => w.id));
    const missing = verbs.filter((w) => !(w.id in current));
    const stale = Object.keys(current).filter((id) => !ids.has(id));
    if (process.env.UPDATE_PP_EXPECTED) {
      const next: Record<string, string> = {};
      for (const w of verbs) next[w.id] = current[w.id] ?? render(w);
      writeFileSync(
        join(__dirname, "participle.expected.json"),
        JSON.stringify(next, null, 2) + "\n",
      );
      console.log(`added ${missing.length}, removed ${stale.length} — AUDIT the new entries`);
      return;
    }
    expect(missing.map((w) => w.id)).toEqual([]);
    expect(stale).toEqual([]);
  });
});
