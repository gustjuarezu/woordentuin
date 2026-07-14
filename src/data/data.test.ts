import { describe, expect, it } from "vitest";
import { validateWords } from "../../tools/ingest/validate";
import { chapters } from "./index";
import type { Word } from "./types";
import h7 from "./chapters/hoofdstuk-07.json";
import h8 from "./chapters/hoofdstuk-08.json";

const files: [number, Word[]][] = [
  [7, h7 as Word[]],
  [8, h8 as Word[]],
];

describe("chapter data", () => {
  it.each(files)("hoofdstuk-%02d.json passes schema validation", (n, words) => {
    expect(validateWords(words, n)).toEqual([]);
  });

  it("registry word counts match the files", () => {
    for (const [n, words] of files) {
      expect(chapters.find((c) => c.number === n)?.wordCount).toBe(words.length);
    }
  });

  it("ids are globally unique", () => {
    const all = files.flatMap(([, w]) => w).map((w) => w.id);
    expect(new Set(all).size).toBe(all.length);
  });

  // Golden fixtures (brief §5.3): the migrated data must preserve the
  // prototype's content for spot-checked entries.
  it("preserves prototype content (golden spot checks)", () => {
    const h8w = h8 as Word[];
    const aarde = h8w.find((w) => w.id === "h8-de-aarde")!;
    expect(aarde).toMatchObject({
      nl: "de aarde", lemma: "aarde", article: "de", pos: "noun",
      en: ["Earth", "soil"], primaryEn: "Earth", note: "hier: Earth, ook: soil",
    });
    const aanmoedigen = h8w.find((w) => w.id === "h8-aanmoedigen")!;
    expect(aanmoedigen).toMatchObject({ separable: true, hint: "aan … moedigen", pos: "verb" });
    const echter = h8w.find((w) => w.id === "h8-echter")!;
    expect(echter).toMatchObject({ struikelwoord: true, pos: "adverb", source: "struikelwoorden" });
    expect(echter.examples?.[0]).toContain("afval scheiden");
    const gedragen = h8w.find((w) => w.id === "h8-zich-gedragen")!;
    expect(gedragen).toMatchObject({ reflexive: true, lemma: "gedragen", pos: "verb" });
  });
});
