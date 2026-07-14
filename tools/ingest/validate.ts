/**
 * Schema validation for chapter JSON files (brief §5.2 step 6).
 * Pure function used by both the ingest CLI and the vitest suite.
 * Fails loudly: returns a list of human-readable problems (empty = valid).
 */
import type { Word } from "../../src/data/types";

const POS = ["noun", "verb", "adjective", "adverb", "phrase", "other"];
const SOURCES = ["vocabulaire-list", "index", "struikelwoorden", "generated"];

export function validateWords(words: unknown, expectedChapter?: number): string[] {
  const problems: string[] = [];
  if (!Array.isArray(words)) return ["chapter file is not an array"];
  const ids = new Set<string>();
  words.forEach((raw, i) => {
    const at = (msg: string) => problems.push(`entry ${i} (${(raw as Word)?.id ?? "?"}): ${msg}`);
    if (typeof raw !== "object" || raw === null) return at("not an object");
    const w = raw as Partial<Word>;
    if (!w.id || typeof w.id !== "string") at("missing id");
    else if (ids.has(w.id)) at(`duplicate id ${w.id}`);
    else ids.add(w.id);
    if (typeof w.chapter !== "number") at("missing chapter");
    else if (expectedChapter !== undefined && w.chapter !== expectedChapter)
      at(`chapter ${w.chapter} ≠ expected ${expectedChapter}`);
    if (!w.nl || typeof w.nl !== "string") at("missing nl");
    if (!w.lemma || typeof w.lemma !== "string") at("missing lemma");
    if (w.article !== undefined && w.article !== "de" && w.article !== "het") at(`bad article ${w.article}`);
    if (!w.pos || !POS.includes(w.pos)) at(`bad pos ${w.pos}`);
    if (!Array.isArray(w.en) || w.en.length === 0 || w.en.some((g) => typeof g !== "string" || !g.trim()))
      at("en must be a non-empty string array");
    if (!w.primaryEn || typeof w.primaryEn !== "string") at("missing primaryEn");
    else if (Array.isArray(w.en) && !w.en.includes(w.primaryEn)) at("primaryEn not in en[]");
    if (!w.source || !SOURCES.includes(w.source)) at(`bad source ${w.source}`);
    if (w.struikelwoord && (!Array.isArray(w.examples) || w.examples.length === 0))
      at("struikelwoord without examples");
    if (w.examples !== undefined && (!Array.isArray(w.examples) || w.examples.some((e) => typeof e !== "string")))
      at("bad examples");
    if (w.irregular !== undefined && typeof w.irregular !== "object") at("bad irregular");
  });
  return problems;
}
