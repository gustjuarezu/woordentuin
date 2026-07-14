import { describe, expect, it } from "vitest";
import type { Word } from "../data/types";
import { acceptedDutch, acceptedEnglish, checkDutch, checkEnglish, normalize } from "./checkAnswer";

const word = (over: Partial<Word>): Word => ({
  id: "h8-test",
  chapter: 8,
  nl: "de aarde",
  lemma: "aarde",
  article: "de",
  pos: "noun",
  en: ["Earth", "soil"],
  primaryEn: "Earth",
  source: "vocabulaire-list",
  ...over,
});

describe("normalize", () => {
  it("lowercases, trims, collapses spaces", () => {
    expect(normalize("  De   Aarde ")).toBe("de aarde");
  });
  it("strips trailing punctuation", () => {
    expect(normalize("aarde!?.")).toBe("aarde");
  });
  it("strips diacritics", () => {
    expect(normalize("vegetariër")).toBe("vegetarier");
    expect(normalize("geïnteresseerd")).toBe("geinteresseerd");
  });
});

describe("checkDutch", () => {
  it("accepts the printed form", () => {
    expect(checkDutch(word({}), "de aarde")).toBe(true);
  });
  it("accepts the lemma without article", () => {
    expect(checkDutch(word({}), "aarde")).toBe(true);
  });
  it("accepts answer typed with a different/extra article", () => {
    expect(checkDutch(word({}), "het aarde")).toBe(true); // article stripped both sides
  });
  it("accepts reflexive with and without zich", () => {
    const w = word({ nl: "zich gedragen", lemma: "gedragen", article: undefined, pos: "verb", reflexive: true, en: ["to behave"], primaryEn: "to behave" });
    expect(checkDutch(w, "zich gedragen")).toBe(true);
    expect(checkDutch(w, "gedragen")).toBe(true);
  });
  it("is case/diacritic/punctuation forgiving", () => {
    const w = word({ nl: "de vegetariër", lemma: "vegetariër" });
    expect(checkDutch(w, "Vegetarier!")).toBe(true);
  });
  it("rejects wrong words", () => {
    expect(checkDutch(word({}), "de grond")).toBe(false);
    expect(checkDutch(word({}), "")).toBe(false);
  });
  it("does not accept a bare shared article", () => {
    expect(checkDutch(word({}), "de")).toBe(false);
  });
});

describe("checkEnglish", () => {
  it("accepts any gloss in en[]", () => {
    expect(checkEnglish(word({}), "Earth")).toBe(true);
    expect(checkEnglish(word({}), "soil")).toBe(true);
  });
  it("strips leading to/the", () => {
    const w = word({ en: ["to encourage"], primaryEn: "to encourage" });
    expect(checkEnglish(w, "encourage")).toBe(true);
    expect(checkEnglish(word({}), "the earth")).toBe(true);
  });
  it("rejects wrong glosses", () => {
    expect(checkEnglish(word({}), "moon")).toBe(false);
  });
});

describe("accepted sets", () => {
  it("dedupe variants", () => {
    expect(acceptedDutch(word({}))).toEqual(["de aarde", "aarde"]);
    expect(acceptedEnglish(word({}))).toContain("earth");
  });
});
