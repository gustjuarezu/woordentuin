import overrides from "../data/participle-overrides.json";
import type { Word } from "../data/types";
import { normalize } from "./checkAnswer";

/** Voltooid deelwoord (past participle) for the per-chapter participle drill.
 * Irregular forms come from the book's "onregelmatige werkwoorden" list
 * (Word.irregular.perfect); regular forms are derived by rule ('t kofschip).
 * A verb counts as irregular only when its actual participle differs from the
 * derived weak form — so book-listed verbs with a weak participle (afvragen →
 * afgevraagd) honestly show as regular for this skill. */

export interface ParticipleInfo {
  participle: string; // "gewerkt", "gezongen", "aangemoedigd"
  aux: "zijn" | "beide" | null; // from the book's "is …"/"(is) …"; null = hebben/unknown
  irregular: boolean;
  parts?: string[]; // regular build-up, e.g. ["ge","werk","t"] or ["aan","ge","moedig","d"]
}

export const PP_SUFFIX = "#pp";
export const ppKey = (wordId: string) => wordId + PP_SUFFIX;

// Longest-first so "onderuit" wins over "onder", "open" over "op".
const SEPARABLE_PREFIXES = [
  "onderuit", "terecht", "binnen", "voorbij", "tegen", "terug", "thuis", "langs",
  "samen", "flauw", "dicht", "wild", "open", "over", "door", "voor", "rond",
  "vast", "vrij", "aan", "mee", "mis", "weg", "af", "bij", "in", "na", "om",
  "op", "stil", "toe", "uit",
].sort((a, b) => b.length - a.length);

// No "er-": it false-positives on ergeren, and the only er- verb in the book
// (ervaren) is irregular and carries its form in the data.
const INSEPARABLE = /^(be|ge|her|ont|ver)/;
const hasVowel = (s: string) => /[aeiou]/.test(s);

/** Derive the regular (weak) participle of an infinitive. Returns null when
 * the infinitive doesn't end in -en (gaan/staan/doen/zien compounds — those
 * are all irregular and carry their form in the data). */
export function deriveRegularParticiple(
  infinitive: string,
  separable: boolean,
): { form: string; parts: string[] } | null {
  if (separable) {
    const p = SEPARABLE_PREFIXES.find(
      (pre) => infinitive.startsWith(pre) && infinitive.length > pre.length + 2,
    );
    if (p) {
      const inner = deriveRegularParticiple(infinitive.slice(p.length), false);
      return inner && { form: p + inner.form, parts: [p, ...inner.parts] };
    }
  }
  // <5 letters excludes "doen" (irregular; monosyllabic stems derive garbage).
  if (!infinitive.endsWith("en") || infinitive.length < 5) return null;
  const stem0 = infinitive.slice(0, -2);

  // 't kofschip on the ORIGINAL final consonant: v/z are voiced (→ d) even
  // though the stem is later spelled with f/s.
  const voiceless = /(t|k|f|s|p|x|ch)$/.test(stem0);

  let stem = stem0;
  const schwaEnding =
    /[bcdfghjklmnpqrstvwxz]e[lnr]$/.test(stem0) &&
    hasVowel(stem0.slice(0, -3)) &&
    // verbs stressed on the -e- (verLEnen → verleend) are not schwa endings
    !overrides.stressedStems.some((s) => infinitive.endsWith(s));
  if (schwaEnding) {
    // Schwa ending (twijfel, teken) — except -er verbs, which default to the
    // stressed loan pattern (studeren → studeer) unless listed as schwa stems.
    if (stem0.endsWith("er") && !overrides.schwaStems.some((s) => infinitive.endsWith(s))) {
      stem = stem0.slice(0, -2) + "eer";
    }
  } else {
    const gem = stem0.match(/([bcdfghjklmnpqrstvwxz])\1$/);
    if (gem) {
      stem = stem0.slice(0, -1); // zett → zet
    } else if (/(^|[^aeiou])[aeou][bcdfghklmnpqrstvz]$/.test(stem0)) {
      stem = stem0.slice(0, -1) + stem0[stem0.length - 2] + stem0[stem0.length - 1]; // mak → maak
    }
    stem = stem.replace(/v$/, "f").replace(/z$/, "s"); // leev → leef, verhuiz → verhuis
  }

  const suffix = voiceless ? "t" : "d";
  const insep = infinitive.match(INSEPARABLE);
  const skipGe =
    (insep !== null && hasVowel(stem0.slice(insep[0].length))) || // bereiken, but not verven
    overrides.noGe.some((s) => infinitive.endsWith(s)); // omarmen, overnachten
  const ge = skipGe ? "" : /^e/.test(stem) ? "geë" : /^i/.test(stem) ? "geï" : "ge";
  const geStem = ge ? ge + stem.slice(/^[ei]/.test(stem) ? 1 : 0) : stem;
  const form = geStem + (stem.endsWith(suffix) ? "" : suffix);
  const parts = [skipGe ? "" : "ge", stem, stem.endsWith(suffix) ? "" : suffix].filter(Boolean);
  return { form, parts };
}

function isSeparable(word: Word): boolean {
  return word.separable === true || overrides.separable.some((s) => word.lemma.endsWith(s));
}

/** Full participle info for a verb, or null when none can be determined. */
export function participleFor(word: Word): ParticipleInfo | null {
  const head = word.lemma.split(" ")[0]; // "houden aan" → "houden"
  const derived = deriveRegularParticiple(head, isSeparable(word));

  let actual: string | undefined;
  let aux: ParticipleInfo["aux"] = null;
  const perfect =
    word.irregular?.perfect ??
    (overrides.irregular as Record<string, { participle: string }>)[word.lemma]?.participle;
  if (perfect) {
    if (perfect.startsWith("(is) ")) {
      aux = "beide";
      actual = perfect.slice(5);
    } else if (perfect.startsWith("is ")) {
      aux = "zijn";
      actual = perfect.slice(3);
    } else {
      actual = perfect;
    }
  }

  if (actual) {
    const regular = derived !== null && normalize(actual) === normalize(derived.form);
    return { participle: actual, aux, irregular: !regular, parts: regular ? derived!.parts : undefined };
  }
  if (!derived) return null;
  return { participle: derived.form, aux: null, irregular: false, parts: derived.parts };
}

/** The verbs of a chapter that can be drilled: real verbs with a resolvable
 * participle, minus the few entries mis-tagged as verbs in the book data. */
export function eligibleParticipleVerbs(words: Word[]): Word[] {
  return words.filter(
    (w) =>
      w.pos === "verb" &&
      !overrides.exclude.includes(w.id) &&
      !w.nl.startsWith("(") &&
      participleFor(w) !== null,
  );
}

const AUX_LEAD = /^((ik|jij|je|hij|zij|ze|u|wij|we)\s+)?(heb|hebt|heeft|hebben|ben|bent|is|zijn)\s+/;

/** Strict check on the participle itself (the spelling IS the skill), but a
 * leading auxiliary/"zich" is accepted and diacritics are forgiven. */
export function checkParticiple(info: ParticipleInfo, answer: string): boolean {
  const a = normalize(answer).replace(AUX_LEAD, "").replace(/^zich\s+/, "");
  return a === normalize(info.participle);
}
