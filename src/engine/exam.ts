import type { Word } from "../data/types";
import level4 from "../data/exam/level4.json";
import type { CardState } from "./srs";
import { growthStage, isDue } from "./srs";
import {
  eligibleExercises,
  PAIRS_SIZE,
  shuffle,
  type ExerciseType,
  type SessionOptions,
  type SessionTask,
} from "./session";

/**
 * TaalBoost Level 4 "Niveautoets" (mock exam over Hoofdstuk 6–10).
 *
 * Test progress lives on a separate `id#test` SRS sub-deck (like the participle
 * drill's `#pp`), so it never touches the garden, the global review queue, or
 * the daily new-word budget — the same flat `cardStates` map, isolated by key
 * suffix. See the curated word set in `src/data/exam/level4.json`.
 */
export const TEST_SUFFIX = "#test";
export const testKey = (wordId: string) => wordId + TEST_SUFFIX;

export type ExamBucket = "geld" | "handout" | "orange";
export interface ExamEntry {
  word: Word;
  bucket: ExamBucket;
}

const GELD_CHAPTER: number = level4.geldChapter;
const [CH_LO, CH_HI] = level4.chapterRange as [number, number];
const HANDOUT_LEMMAS = new Set<string>(level4.handoutLemmas);
const EXTRA_WORDS = level4.extraWords as Word[];

export const DEFAULT_TEST_SIZE = 20;
/** Target share of questions drawn from the Geld + handout ("high") buckets. */
export const GELD_TARGET_SHARE = 0.65;

/**
 * Build the weighted Level 4 exam pool: every H6–10 word plus the curated
 * handout extras missing from the book. H10 words are `geld`; other book words
 * emphasized in the Les 11 handout are `handout`; the rest of H6–9 is `orange`
 * filler. Extras are always `handout`.
 */
export function buildLevel4ExamPool(allWords: Word[]): ExamEntry[] {
  const seen = new Set<string>();
  const entries: ExamEntry[] = [];
  const push = (word: Word, bucket: ExamBucket) => {
    if (seen.has(word.id)) return;
    seen.add(word.id);
    entries.push({ word, bucket });
  };
  for (const w of allWords) {
    if (w.chapter < CH_LO || w.chapter > CH_HI) continue;
    const bucket: ExamBucket =
      w.chapter === GELD_CHAPTER ? "geld" : HANDOUT_LEMMAS.has(w.lemma) ? "handout" : "orange";
    push(w, bucket);
  }
  for (const w of EXTRA_WORDS) push(w, "handout");
  return entries;
}

/** Order a stratum for picking: due `#test` cards first (spaced review on
 * retakes), then never-tested words, then the weakest of the rest. */
function orderByPriority(
  entries: ExamEntry[],
  states: Map<string, CardState>,
  now: number,
  rng: () => number,
): Word[] {
  const withState = entries.map((e) => ({ word: e.word, s: states.get(testKey(e.word.id)) }));
  const due = shuffle(
    withState.filter((x) => x.s && isDue(x.s, now)),
    rng,
  );
  const fresh = shuffle(
    withState.filter((x) => !x.s),
    rng,
  );
  const rest = withState
    .filter((x) => x.s && !isDue(x.s, now))
    .sort((a, b) => growthStage(a.s) - growthStage(b.s));
  return [...due, ...fresh, ...rest].map((x) => x.word);
}

function pickExercise(word: Word, opts: SessionOptions, rng: () => number): ExerciseType {
  const el = eligibleExercises(word, opts);
  return el[Math.floor(rng() * el.length)];
}

/**
 * Turn the exam pool into a task queue of `size` cards, stratified so ~65% come
 * from the Geld + handout buckets and the rest from H6–9 filler, with a fresh
 * mix of exercise types and an optional tap-the-pairs block. A short stratum is
 * backfilled from the other so the round always reaches `size` when the pool
 * allows. Unlike `buildTasks`, there is no recognition-first gate: the `#test`
 * deck starts empty, so we want the full exercise mix from the first attempt.
 */
export function buildExamTasks(
  pool: ExamEntry[],
  states: Map<string, CardState>,
  opts: SessionOptions = {},
  size = DEFAULT_TEST_SIZE,
  now = Date.now(),
): SessionTask[] {
  const rng = opts.rng ?? Math.random;
  const highOrdered = orderByPriority(
    pool.filter((e) => e.bucket !== "orange"),
    states,
    now,
    rng,
  );
  const lowOrdered = orderByPriority(
    pool.filter((e) => e.bucket === "orange"),
    states,
    now,
    rng,
  );

  const cap = Math.min(size, pool.length);
  let nHigh = Math.min(Math.round(cap * GELD_TARGET_SHARE), highOrdered.length);
  let nLow = cap - nHigh;
  if (nLow > lowOrdered.length) {
    nLow = lowOrdered.length;
    nHigh = Math.min(cap - nLow, highOrdered.length);
  }

  const picked = shuffle([...highOrdered.slice(0, nHigh), ...lowOrdered.slice(0, nLow)], rng);
  const tasks: SessionTask[] = picked.map((word) => ({
    kind: "card",
    word,
    exercise: pickExercise(word, opts, rng),
  }));

  if (opts.includePairs !== false && picked.length >= PAIRS_SIZE) {
    const pairWords = shuffle(picked, rng).slice(0, Math.min(6, picked.length));
    tasks.push({ kind: "pairs", words: pairWords });
  }
  return tasks;
}
