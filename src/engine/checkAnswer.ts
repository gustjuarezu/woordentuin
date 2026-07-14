import type { Word } from "../data/types";

/** Normalization per brief §3.3: lowercase, trim, strip trailing punctuation,
 * collapse spaces, strip diacritics. Leading articles/particles are stripped
 * separately so both "de aarde" and "aarde" are accepted. */
export function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[.!?,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NL_LEAD = /^(de|het|een|zich)\s+/;
const EN_LEAD = /^(to|the|a|an)\s+/;

function variants(s: string, lead: RegExp): string[] {
  const n = normalize(s);
  const stripped = n.replace(lead, "");
  return n === stripped ? [n] : [n, stripped];
}

/** Accepted normalized forms for a typed Dutch answer: nl and lemma, each
 * with and without a leading article/zich. */
export function acceptedDutch(word: Word): string[] {
  return [...new Set([...variants(word.nl, NL_LEAD), ...variants(word.lemma, NL_LEAD)])];
}

/** Accepted normalized forms for a typed/selected English answer: every
 * gloss in `en`, with and without a leading "to "/"the "/article. */
export function acceptedEnglish(word: Word): string[] {
  return [...new Set(word.en.flatMap((g) => variants(g, EN_LEAD)))];
}

export function checkDutch(word: Word, answer: string): boolean {
  const a = variants(answer, NL_LEAD);
  const ok = acceptedDutch(word);
  return a.some((v) => ok.includes(v));
}

export function checkEnglish(word: Word, answer: string): boolean {
  const a = variants(answer, EN_LEAD);
  const ok = acceptedEnglish(word);
  return a.some((v) => ok.includes(v));
}
