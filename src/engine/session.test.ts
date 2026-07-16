import { describe, expect, it } from "vitest";
import type { Word } from "../data/types";
import { gradeCard, newCardState, type CardState } from "./srs";
import { ppKey } from "./participle";
import {
  buildLessonWords,
  buildParticipleTasks,
  buildReviewWords,
  buildTasks,
  chunkLessons,
  countDue,
  countDuePP,
  outcomeToGrade,
  pickDistractors,
} from "./session";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

const mkWord = (i: number, over: Partial<Word> = {}): Word => ({
  id: `h7-word-${i}`,
  chapter: 7,
  nl: `woord${i}`,
  lemma: `woord${i}`,
  pos: "noun",
  en: [`gloss${i}`],
  primaryEn: `gloss${i}`,
  source: "vocabulaire-list",
  ...over,
});

const words = Array.from({ length: 20 }, (_, i) => mkWord(i));

function seeded(seed = 42): () => number {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

function statesWith(entries: [string, CardState][]): Map<string, CardState> {
  return new Map(entries);
}

describe("chunkLessons", () => {
  it("splits into lessons of ~7 with no empty chunks", () => {
    const lessons = chunkLessons(words, 7);
    expect(lessons.flat()).toHaveLength(20);
    for (const l of lessons) expect(l.length).toBeGreaterThanOrEqual(6);
    for (const l of lessons) expect(l.length).toBeLessThanOrEqual(8);
  });
  it("handles tiny chapters", () => {
    expect(chunkLessons(words.slice(0, 3), 7)).toHaveLength(1);
    expect(chunkLessons([], 7)).toHaveLength(0);
  });
});

describe("buildLessonWords", () => {
  it("caps new words by the daily throttle", () => {
    const lesson = words.slice(0, 7);
    const { newWords } = buildLessonWords(lesson, words, new Map(), NOW, 3, { rng: seeded() });
    expect(newWords).toHaveLength(3);
  });
  it("fills the round with due reviews from the chapter", () => {
    const lesson = words.slice(0, 7);
    const due = gradeCard(newCardState(words[10].id), "good", NOW - 2 * DAY);
    const states = statesWith([[words[10].id, due]]);
    const { newWords, reviewWords } = buildLessonWords(lesson, words, states, NOW, 8, { rng: seeded() });
    expect(newWords).toHaveLength(7);
    expect(reviewWords.map((w) => w.id)).toContain(words[10].id);
  });
  it("does not duplicate a word as both new and review", () => {
    const lesson = words.slice(0, 7);
    const introduced = gradeCard(newCardState(words[0].id), "good", NOW - 2 * DAY);
    const states = statesWith([[words[0].id, introduced]]);
    const { newWords, reviewWords } = buildLessonWords(lesson, words, states, NOW, 8, { rng: seeded() });
    const all = [...newWords, ...reviewWords].map((w) => w.id);
    expect(new Set(all).size).toBe(all.length);
    expect(newWords.map((w) => w.id)).not.toContain(words[0].id);
    expect(reviewWords.map((w) => w.id)).toContain(words[0].id);
  });
});

describe("buildReviewWords / countDue", () => {
  it("collects due cards across all words", () => {
    const s1 = gradeCard(newCardState(words[1].id), "good", NOW - 2 * DAY); // due
    const s2 = gradeCard(newCardState(words[2].id), "good", NOW);           // not due
    const states = statesWith([[words[1].id, s1], [words[2].id, s2]]);
    const due = buildReviewWords(words, states, NOW, 20, seeded());
    expect(due.map((w) => w.id)).toEqual([words[1].id]);
    expect(countDue(words, states, NOW)).toBe(1);
  });
  it("caps the queue", () => {
    const states = statesWith(
      words.map((w) => [w.id, gradeCard(newCardState(w.id), "good", NOW - 2 * DAY)] as [string, CardState]),
    );
    expect(buildReviewWords(words, states, NOW, 5, seeded())).toHaveLength(5);
  });
});

describe("buildTasks", () => {
  it("gives never-introduced words recognition (mc-nl-en) first", () => {
    const tasks = buildTasks(words.slice(0, 5), new Map(), { rng: seeded(), includePairs: false });
    for (const t of tasks) {
      expect(t.kind).toBe("card");
      if (t.kind === "card") expect(t.exercise).toBe("mc-nl-en");
    }
  });
  it("mixes types for introduced words and appends a pairs block", () => {
    const states = statesWith(
      words.map((w) => [w.id, gradeCard(newCardState(w.id), "good", NOW)] as [string, CardState]),
    );
    const tasks = buildTasks(words.slice(0, 8), states, { rng: seeded(7), ttsAvailable: true });
    const cardTypes = new Set(tasks.filter((t) => t.kind === "card").map((t) => (t as { exercise: string }).exercise));
    expect(cardTypes.size).toBeGreaterThan(1);
    const pairs = tasks.filter((t) => t.kind === "pairs");
    expect(pairs).toHaveLength(1);
    if (pairs[0].kind === "pairs") expect(pairs[0].words.length).toBeGreaterThanOrEqual(5);
  });
  it("never assigns listening without a Dutch voice", () => {
    const states = statesWith(
      words.map((w) => [w.id, gradeCard(newCardState(w.id), "good", NOW)] as [string, CardState]),
    );
    for (let seed = 1; seed < 10; seed++) {
      const tasks = buildTasks(words.slice(0, 8), states, { rng: seeded(seed), ttsAvailable: false, includePairs: false });
      for (const t of tasks) if (t.kind === "card") expect(t.exercise).not.toBe("listen");
    }
  });
});

describe("buildParticipleTasks", () => {
  const verbs = Array.from({ length: 15 }, (_, i) => mkWord(i, { pos: "verb" }));
  const dueState = () => ({ ...gradeCard(newCardState(""), "good", NOW - 3 * DAY), wordId: "" });

  it("emits only type-participle card tasks, capped at max", () => {
    const tasks = buildParticipleTasks(verbs, new Map(), NOW, 10, seeded());
    expect(tasks).toHaveLength(10);
    for (const t of tasks) {
      expect(t.kind).toBe("card");
      if (t.kind === "card") expect(t.exercise).toBe("type-participle");
    }
  });

  it("puts due #pp cards before never-drilled verbs and reads only #pp state", () => {
    const states = statesWith([
      // vocab-introduced but never participle-drilled → still counts as fresh
      [verbs[0].id, gradeCard(newCardState(verbs[0].id), "good", NOW)],
      [ppKey(verbs[1].id), { ...dueState(), wordId: ppKey(verbs[1].id) }],
      [ppKey(verbs[2].id), gradeCard(newCardState(ppKey(verbs[2].id)), "good", NOW)], // not due
    ]);
    const tasks = buildParticipleTasks(verbs, states, NOW, 20, seeded());
    const ids = tasks.map((t) => (t.kind === "card" ? t.word.id : ""));
    expect(ids[0]).toBe(verbs[1].id); // the one due #pp card leads
    expect(ids).toContain(verbs[0].id); // plain-id state is ignored
    expect(ids.indexOf(verbs[2].id)).toBe(ids.length - 1); // non-due drilled card fills last
    expect(countDuePP(verbs, states, NOW)).toBe(1);
  });
});

describe("pickDistractors", () => {
  it("excludes the target and duplicate glosses", () => {
    const clone = mkWord(99, { en: words[0].en, primaryEn: words[0].primaryEn });
    const d = pickDistractors(words[0], [...words, clone], 3, seeded());
    expect(d).toHaveLength(3);
    expect(d.map((w) => w.id)).not.toContain(words[0].id);
    expect(d.map((w) => w.primaryEn)).not.toContain(words[0].primaryEn);
  });
});

describe("outcomeToGrade", () => {
  it("maps outcomes per the brief", () => {
    expect(outcomeToGrade(false, false, 1000)).toBe("again");
    expect(outcomeToGrade(true, true, 1000)).toBe("hard");   // hint ⇒ hard even when fast
    expect(outcomeToGrade(true, false, 1000)).toBe("easy");
    expect(outcomeToGrade(true, false, 20000)).toBe("good");
  });
});
