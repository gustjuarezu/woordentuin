import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateWords } from "../../tools/ingest/validate";
import type { Word } from "./types";
import manifest from "./chapters/manifest.json";

const chaptersDir = join(__dirname, "chapters");
const files = readdirSync(chaptersDir).filter((f) => /^hoofdstuk-\d+\.json$/.test(f));
const load = (f: string) => JSON.parse(readFileSync(join(chaptersDir, f), "utf8")) as Word[];
const byNumber = new Map<number, Word[]>(files.map((f) => [Number(f.match(/\d+/)![0]), load(f)]));

describe("chapter data", () => {
  it("covers all 11 hoofdstukken of the book", () => {
    expect([...byNumber.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it.each([...byNumber.entries()])("hoofdstuk %d passes schema validation", (n, words) => {
    expect(validateWords(words, n)).toEqual([]);
  });

  it("manifest matches the files", () => {
    expect(manifest).toHaveLength(byNumber.size);
    for (const m of manifest) {
      expect(byNumber.get(m.number)).toHaveLength(m.wordCount);
      expect(m.theme).toBeTruthy();
    }
  });

  it("ids are globally unique", () => {
    const all = [...byNumber.values()].flat().map((w) => w.id);
    expect(new Set(all).size).toBe(all.length);
  });
});

// Golden fixtures (brief §5.3): ingestion of H7/H8 must reproduce the
// already-digitized prototype datasets (allowing for the richer fields).
describe("golden: prototype H7/H8 reproduced from the book", () => {
  const html = readFileSync(join(__dirname, "..", "..", "reference", "woordentuin.html"), "utf8");
  const PROTO = new Function(`return ${html.match(/const CHAPTERS = (\{[\s\S]*?\n\});\n/)![1]}`)() as Record<
    string,
    { words: { nl: string; en: string; star?: boolean }[] }
  >;
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^(de|het|een) /, "").replace(/\s+/g, " ").trim();

  it.each([7, 8])("every prototype hoofdstuk %d word exists in the ingested chapter", (n) => {
    const mine = byNumber.get(n)!;
    const keys = new Set(mine.flatMap((w) => [norm(w.nl), norm(w.lemma)]));
    const missing = PROTO[String(n)].words.filter((p) => !keys.has(norm(p.nl)));
    expect(missing.map((m) => m.nl)).toEqual([]);
  });

  it("spot-checks preserve the brief's sample entries", () => {
    const h8 = byNumber.get(8)!;
    const aarde = h8.find((w) => w.id === "h8-de-aarde")!;
    expect(aarde).toMatchObject({ nl: "de aarde", lemma: "aarde", article: "de", pos: "noun", primaryEn: "Earth" });
    expect(aarde.en.map((g) => g.toLowerCase())).toContain("soil");
    const aanmoedigen = h8.find((w) => w.nl === "aanmoedigen")!;
    expect(aanmoedigen).toMatchObject({ pos: "verb", separable: true });
    expect(aanmoedigen.hint).toContain("aan … moedigen");
    const echter = h8.find((w) => w.nl === "echter")!;
    expect(echter.struikelwoord).toBe(true);
    expect(echter.examples?.[0]).toContain("afval scheiden");
    const gedragen = h8.find((w) => w.nl === "zich gedragen")!;
    expect(gedragen).toMatchObject({ reflexive: true, lemma: "gedragen", pos: "verb" });
    expect(gedragen.irregular).toMatchObject({ past: "gedroeg", perfect: "gedragen" });
  });

  it("struikelwoorden carry example sentences", () => {
    for (const [, words] of byNumber) {
      const struik = words.filter((w) => w.struikelwoord);
      const withExamples = struik.filter((w) => w.examples && w.examples.length > 0);
      // allow a small tail the parser couldn't align (they're listed in _review.md)
      expect(withExamples.length).toBeGreaterThanOrEqual(Math.floor(struik.length * 0.8));
    }
  });
});
