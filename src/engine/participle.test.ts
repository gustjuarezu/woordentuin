import { describe, expect, it } from "vitest";
import type { Word } from "../data/types";
import {
  checkParticiple,
  deriveRegularParticiple,
  eligibleParticipleVerbs,
  participleFor,
  ppKey,
} from "./participle";

const word = (over: Partial<Word>): Word => ({
  id: "hx-test",
  chapter: 1,
  nl: "testen",
  lemma: "testen",
  pos: "verb",
  en: ["to test"],
  primaryEn: "to test",
  source: "vocabulaire-list",
  ...over,
});

describe("deriveRegularParticiple", () => {
  const cases: [string, boolean, string][] = [
    // plain weak verbs, 't kofschip
    ["werken", false, "gewerkt"],
    ["maken", false, "gemaakt"],
    ["pakken", false, "gepakt"],
    ["wachten", false, "gewacht"], // stem already ends in t
    ["redden", false, "gered"], // degeminate, stem already ends in d
    ["tutten", false, "getut"],
    ["gillen", false, "gegild"],
    // v/z voicing: suffix follows the ORIGINAL consonant, spelling devoices
    ["leven", false, "geleefd"],
    ["verhuizen", false, "verhuisd"],
    ["durven", false, "gedurfd"],
    // vowel doubling — but never before w, and never after a digraph
    ["sturen", false, "gestuurd"],
    ["duwen", false, "geduwd"],
    ["kauwen", false, "gekauwd"],
    ["bereiken", false, "bereikt"],
    // inseparable prefixes: no ge- (but "verven" is not a ver- verb)
    ["vernoemen", false, "vernoemd"],
    ["gebeuren", false, "gebeurd"],
    ["herstellen", false, "hersteld"],
    ["ontdekken", false, "ontdekt"],
    ["verven", false, "geverfd"],
    // schwa endings keep their stem; -eren defaults to the stressed loan -eerd
    ["twijfelen", false, "getwijfeld"],
    ["verlenen", false, "verleend"], // stressed -enen, not schwa
    ["tekenen", false, "getekend"],
    ["ordenen", false, "geordend"],
    ["studeren", false, "gestudeerd"],
    ["kamperen", false, "gekampeerd"],
    ["waarderen", false, "gewaardeerd"],
    // …unless the lemma is a listed schwa stem
    ["ergeren", false, "geërgerd"],
    ["schilderen", false, "geschilderd"],
    ["beschilderen", false, "beschilderd"],
    ["fluisteren", false, "gefluisterd"],
    ["beluisteren", false, "beluisterd"],
    ["veroveren", false, "veroverd"],
    // short -eren stems are not schwa endings (no earlier vowel)
    ["keren", false, "gekeerd"],
    ["voeren", false, "gevoerd"],
    ["spelen", false, "gespeeld"],
    // diaeresis after ge-
    ["eindigen", false, "geëindigd"],
    ["informeren", false, "geïnformeerd"],
    ["isoleren", false, "geïsoleerd"],
    ["uiten", false, "geuit"],
    // separable verbs: prefix + ge + stem + t/d
    ["aanmoedigen", true, "aangemoedigd"],
    ["openzetten", true, "opengezet"],
    ["terugkeren", true, "teruggekeerd"],
    ["uitoefenen", true, "uitgeoefend"],
    ["opleveren", true, "opgeleverd"],
    ["inburgeren", true, "ingeburgerd"],
    ["afstuderen", true, "afgestudeerd"],
    ["uitputten", true, "uitgeput"],
  ];
  it.each(cases)("%s → %s", (inf, sep, expected) => {
    expect(deriveRegularParticiple(inf, sep)?.form).toBe(expected);
  });

  it("returns null for non -en infinitives (gaan/staan/doen/zien compounds)", () => {
    expect(deriveRegularParticiple("bestaan", false)).toBeNull();
    expect(deriveRegularParticiple("nadoen", true)).toBeNull(); // inner "doen"… stem is garbage-proofed by the actual form in data
  });

  it("exposes the build-up parts", () => {
    expect(deriveRegularParticiple("werken", false)?.parts).toEqual(["ge", "werk", "t"]);
    expect(deriveRegularParticiple("aanmoedigen", true)?.parts).toEqual(["aan", "ge", "moedig", "d"]);
    expect(deriveRegularParticiple("bereiken", false)?.parts).toEqual(["bereik", "t"]);
    expect(deriveRegularParticiple("wachten", false)?.parts).toEqual(["ge", "wacht"]);
  });
});

describe("participleFor", () => {
  it("uses the book's irregular form and parses the auxiliary", () => {
    const zingen = participleFor(word({ lemma: "zingen", irregular: { perfect: "gezongen" } }));
    expect(zingen).toMatchObject({ participle: "gezongen", aux: null, irregular: true });

    const thuiskomen = participleFor(
      word({ lemma: "thuiskomen", separable: true, irregular: { perfect: "is thuisgekomen" } }),
    );
    expect(thuiskomen).toMatchObject({ participle: "thuisgekomen", aux: "zijn", irregular: true });

    const vliegen = participleFor(word({ lemma: "vliegen", irregular: { perfect: "(is) gevlogen" } }));
    expect(vliegen).toMatchObject({ participle: "gevlogen", aux: "beide", irregular: true });
  });

  it("classifies book-listed verbs with a weak participle as regular", () => {
    const afvragen = participleFor(
      word({ lemma: "afvragen", reflexive: true, irregular: { perfect: "afgevraagd" } }),
    );
    expect(afvragen).toMatchObject({ participle: "afgevraagd", irregular: false });
    expect(afvragen?.parts).toEqual(["af", "ge", "vraag", "d"]);

    const waaien = participleFor(word({ lemma: "waaien", irregular: { perfect: "(is) gewaaid" } }));
    expect(waaien).toMatchObject({ participle: "gewaaid", aux: "beide", irregular: false });
  });

  it("resolves the override irregulars missing from the book list", () => {
    expect(participleFor(word({ lemma: "houden aan", reflexive: true }))).toMatchObject({
      participle: "gehouden",
      irregular: true,
    });
    expect(participleFor(word({ lemma: "bestaan" }))).toMatchObject({
      participle: "bestaan",
      irregular: true,
    });
    expect(participleFor(word({ lemma: "aankijken", separable: true }))).toMatchObject({
      participle: "aangekeken",
      irregular: true,
    });
  });

  it("treats override-separable verbs (flag missing in data) as separable", () => {
    expect(participleFor(word({ lemma: "aanmelden", reflexive: true }))?.participle).toBe("aangemeld");
    expect(participleFor(word({ lemma: "aanpassen" }))?.participle).toBe("aangepast");
    expect(participleFor(word({ lemma: "inzetten" }))?.participle).toBe("ingezet");
    expect(participleFor(word({ lemma: "wegjagen", irregular: { perfect: "weggejaagd" } }))).toMatchObject(
      { participle: "weggejaagd", irregular: false },
    );
  });

  it("derives with the head verb of a multi-word lemma", () => {
    expect(participleFor(word({ lemma: "lenen voor", reflexive: true }))?.participle).toBe("geleend");
  });

  it("handles the noGe override prefixes", () => {
    expect(participleFor(word({ lemma: "omarmen" }))?.participle).toBe("omarmd");
    expect(participleFor(word({ lemma: "overnachten" }))?.participle).toBe("overnacht");
    expect(participleFor(word({ lemma: "overtuigen" }))?.participle).toBe("overtuigd");
  });
});

describe("eligibleParticipleVerbs", () => {
  it("keeps real verbs and drops noise and non-verbs", () => {
    const words = [
      word({ id: "h1-zingen", lemma: "zingen", irregular: { perfect: "gezongen" } }),
      word({ id: "h1-werken", lemma: "werken" }),
      word({ id: "h1-that", nl: "(that)", lemma: "(that)" }),
      word({ id: "h2-about", nl: "about", lemma: "about" }),
      word({ id: "h3-twintigen", lemma: "twintigen" }),
      word({ id: "h1-de-leeftijd", lemma: "leeftijd", pos: "noun" }),
    ];
    expect(eligibleParticipleVerbs(words).map((w) => w.id)).toEqual(["h1-zingen", "h1-werken"]);
  });
});

describe("checkParticiple", () => {
  const info = participleFor(word({ lemma: "werken" }))!;
  it("accepts the bare participle and an optional auxiliary/zich", () => {
    expect(checkParticiple(info, "gewerkt")).toBe(true);
    expect(checkParticiple(info, "heeft gewerkt")).toBe(true);
    expect(checkParticiple(info, "ik heb gewerkt")).toBe(true);
    expect(checkParticiple(info, "  Gewerkt ")).toBe(true);
  });
  it("forgives diacritics but not spelling", () => {
    const erg = participleFor(word({ lemma: "ergeren", reflexive: true }))!;
    expect(checkParticiple(erg, "geergerd")).toBe(true);
    expect(checkParticiple(erg, "heeft zich geërgerd")).toBe(true);
    expect(checkParticiple(info, "gewerkd")).toBe(false);
    expect(checkParticiple(info, "heeft")).toBe(false);
  });
});

describe("ppKey", () => {
  it("suffixes the word id", () => {
    expect(ppKey("h1-zingen")).toBe("h1-zingen#pp");
  });
});
