import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Word } from "../data/types";
import level4 from "../data/exam/level4.json";
import {
  buildExamTasks,
  buildLevel4ExamPool,
  DEFAULT_TEST_SIZE,
  GELD_TARGET_SHARE,
  testKey,
  type ExamBucket,
} from "./exam";

const chaptersDir = join(__dirname, "..", "data", "chapters");
const files = readdirSync(chaptersDir).filter((f) => /^hoofdstuk-\d+\.json$/.test(f));
const allWords: Word[] = files.flatMap((f) => JSON.parse(readFileSync(join(chaptersDir, f), "utf8")) as Word[]);
const extraIds = new Set((level4.extraWords as Word[]).map((w) => w.id));

const NOW = 1_700_000_000_000;

function seeded(seed = 42): () => number {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

describe("buildLevel4ExamPool", () => {
  const pool = buildLevel4ExamPool(allWords);
  const byId = new Map(pool.map((e) => [e.word.id, e]));

  it("includes every H10 (Geld) word", () => {
    const h10 = allWords.filter((w) => w.chapter === 10);
    expect(h10.length).toBeGreaterThan(0);
    for (const w of h10) expect(byId.has(w.id)).toBe(true);
  });

  it("includes every curated handout extra", () => {
    for (const id of extraIds) expect(byId.has(id)).toBe(true);
  });

  it("excludes chapters outside 6–10 (no H1–5, no H11)", () => {
    for (const e of pool) {
      expect(e.word.chapter).toBeGreaterThanOrEqual(6);
      expect(e.word.chapter).toBeLessThanOrEqual(10);
    }
  });

  it("has no id collisions (extras never shadow book words)", () => {
    const ids = pool.map((e) => e.word.id);
    expect(new Set(ids).size).toBe(ids.length);
    const bookIds = new Set(allWords.map((w) => w.id));
    for (const id of extraIds) expect(bookIds.has(id)).toBe(false);
  });

  it("buckets H10 as geld, handoutLemmas as handout, extras as handout", () => {
    for (const e of pool) {
      if (e.word.chapter === 10 && !extraIds.has(e.word.id)) expect(e.bucket).toBe("geld");
    }
    for (const lemma of level4.handoutLemmas) {
      const hit = pool.find((e) => e.word.lemma === lemma);
      expect(hit, `handout lemma "${lemma}" must resolve to a pool word`).toBeTruthy();
      expect(hit!.bucket).toBe("handout");
    }
    for (const id of extraIds) expect(byId.get(id)!.bucket).toBe("handout");
  });

  it("drops nothing the handout flagged: every handout lemma is a book word or an extra", () => {
    const extraLemmas = new Set((level4.extraWords as Word[]).map((w) => w.lemma));
    const poolLemmas = new Set(pool.map((e) => e.word.lemma));
    for (const lemma of level4.handoutLemmas) {
      expect(poolLemmas.has(lemma) || extraLemmas.has(lemma)).toBe(true);
    }
  });
});

describe("buildExamTasks", () => {
  const pool = buildLevel4ExamPool(allWords);
  const bucketOf = new Map<string, ExamBucket>(pool.map((e) => [e.word.id, e.bucket]));

  it("emits `size` unique card tasks weighted ~65% to Geld + handout", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const tasks = buildExamTasks(pool, new Map(), { rng: seeded(seed) }, DEFAULT_TEST_SIZE, NOW);
      const cards = tasks.filter((t) => t.kind === "card") as Extract<(typeof tasks)[number], { kind: "card" }>[];
      expect(cards).toHaveLength(DEFAULT_TEST_SIZE);
      // no duplicate words in a round
      const ids = cards.map((c) => c.word.id);
      expect(new Set(ids).size).toBe(ids.length);
      const high = cards.filter((c) => bucketOf.get(c.word.id) !== "orange").length;
      const share = high / cards.length;
      expect(share).toBeGreaterThanOrEqual(0.6);
      expect(share).toBeLessThanOrEqual(0.7);
    }
  });

  it("hits the target share exactly when both strata are large enough", () => {
    const tasks = buildExamTasks(pool, new Map(), { rng: seeded(3) }, DEFAULT_TEST_SIZE, NOW);
    const cards = tasks.filter((t) => t.kind === "card") as { word: Word }[];
    const high = cards.filter((c) => bucketOf.get(c.word.id) !== "orange").length;
    expect(high).toBe(Math.round(DEFAULT_TEST_SIZE * GELD_TARGET_SHARE));
  });

  it("appends a pairs block", () => {
    const tasks = buildExamTasks(pool, new Map(), { rng: seeded(5) }, DEFAULT_TEST_SIZE, NOW);
    const pairs = tasks.filter((t) => t.kind === "pairs");
    expect(pairs).toHaveLength(1);
  });

  it("never assigns listening without a Dutch voice", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const tasks = buildExamTasks(pool, new Map(), { rng: seeded(seed), ttsAvailable: false }, DEFAULT_TEST_SIZE, NOW);
      for (const t of tasks) if (t.kind === "card") expect(t.exercise).not.toBe("listen");
    }
  });

  it("reads only #test SRS state (prioritises a due test card)", () => {
    const geldWord = pool.find((e) => e.bucket === "geld")!.word;
    const dueTestCard = {
      wordId: testKey(geldWord.id),
      ease: 2.3,
      intervalDays: 1,
      due: NOW - 86_400_000,
      reps: 1,
      lapses: 0,
      introduced: true,
    };
    const states = new Map([[testKey(geldWord.id), dueTestCard]]);
    const tasks = buildExamTasks(pool, states, { rng: seeded(9), includePairs: false }, DEFAULT_TEST_SIZE, NOW);
    const ids = tasks.filter((t) => t.kind === "card").map((t) => (t as { word: Word }).word.id);
    expect(ids).toContain(geldWord.id);
  });

  it("caps at the pool size for a large request", () => {
    const tasks = buildExamTasks(pool, new Map(), { rng: seeded(1), includePairs: false }, 100_000, NOW);
    const cards = tasks.filter((t) => t.kind === "card");
    expect(cards).toHaveLength(pool.length);
  });
});
