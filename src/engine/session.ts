import type { Word } from "../data/types";
import type { CardState, Grade } from "./srs";
import { growthStage, isDue } from "./srs";
import { ppKey } from "./participle";

/** Exercise types (brief §4.3 MVP set + the participle drill). */
export type ExerciseType = "mc-nl-en" | "mc-en-nl" | "type-nl" | "listen" | "type-participle";

export type SessionTask =
  | { kind: "card"; word: Word; exercise: ExerciseType }
  | { kind: "pairs"; words: Word[] };

export interface SessionOptions {
  rng?: () => number;        // injectable for tests
  ttsAvailable?: boolean;    // no Dutch voice → no listening exercises
  includePairs?: boolean;
  lessonSize?: number;
}

export const DEFAULT_LESSON_SIZE = 7;
export const DEFAULT_NEW_PER_DAY = 8; // new-card throttle per chapter per day (Settings)
export const PAIRS_SIZE = 5;

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Split a chapter's words into fixed lessons of ~lessonSize (6–8). */
export function chunkLessons(words: Word[], lessonSize = DEFAULT_LESSON_SIZE): Word[][] {
  if (words.length === 0) return [];
  const n = Math.max(1, Math.round(words.length / lessonSize));
  const size = Math.ceil(words.length / n);
  const out: Word[][] = [];
  for (let i = 0; i < words.length; i += size) out.push(words.slice(i, i + size));
  return out;
}

/** Words in a lesson the learner hasn't been introduced to yet. */
export function newWordsIn(lesson: Word[], states: Map<string, CardState>): Word[] {
  return lesson.filter((w) => !states.get(w.id)?.introduced);
}

/**
 * Build the word list for a lesson session: the lesson's new words (capped by
 * the daily new-card throttle) plus due reviews from the same chapter to fill
 * the round.
 */
export function buildLessonWords(
  lesson: Word[],
  chapterWords: Word[],
  states: Map<string, CardState>,
  now: number,
  newLimitRemaining: number = DEFAULT_NEW_PER_DAY,
  opts: SessionOptions = {},
): { newWords: Word[]; reviewWords: Word[] } {
  const rng = opts.rng ?? Math.random;
  const newWords = newWordsIn(lesson, states).slice(0, Math.max(0, newLimitRemaining));
  const introduced = new Set(newWords.map((w) => w.id));
  const due = chapterWords.filter((w) => {
    const s = states.get(w.id);
    return s && isDue(s, now) && !introduced.has(w.id);
  });
  // Lesson words that are already introduced still belong in the round.
  const lessonReviews = lesson.filter((w) => states.get(w.id)?.introduced && !introduced.has(w.id));
  const fill = shuffle(due.filter((w) => !lessonReviews.some((l) => l.id === w.id)), rng);
  const target = Math.max(lesson.length + 3, 10);
  const reviewWords = [...lessonReviews, ...fill].slice(0, Math.max(0, target - newWords.length));
  return { newWords, reviewWords };
}

/** Global review queue: all due cards across every chapter (SRS heartbeat). */
export function buildReviewWords(
  allWords: Word[],
  states: Map<string, CardState>,
  now: number,
  max = 20,
  rng: () => number = Math.random,
): Word[] {
  const due = allWords.filter((w) => {
    const s = states.get(w.id);
    return s && isDue(s, now);
  });
  // Oldest-due first, lightly shuffled inside the cap.
  due.sort((a, b) => (states.get(a.id)!.due - states.get(b.id)!.due));
  return shuffle(due.slice(0, max), rng);
}

/**
 * Round for the per-chapter participle drill: due participle cards first,
 * then verbs never drilled, then the weakest of the rest. Participle progress
 * lives on separate `id#pp` cards, so this never touches the vocab SRS state
 * and there is no new-word throttle — it's a drill, not vocab introduction.
 */
export function buildParticipleTasks(
  verbs: Word[],
  states: Map<string, CardState>,
  now: number,
  max = 10,
  rng: () => number = Math.random,
): SessionTask[] {
  const due = verbs.filter((w) => {
    const s = states.get(ppKey(w.id));
    return s && isDue(s, now);
  });
  const fresh = verbs.filter((w) => !states.get(ppKey(w.id)));
  const rest = verbs
    .filter((w) => {
      const s = states.get(ppKey(w.id));
      return s && !isDue(s, now);
    })
    .sort((a, b) => growthStage(states.get(ppKey(a.id))) - growthStage(states.get(ppKey(b.id))));
  const pick = [...shuffle(due, rng), ...shuffle(fresh, rng), ...rest].slice(0, max);
  return pick.map((word) => ({ kind: "card", word, exercise: "type-participle" }));
}

export function countDuePP(verbs: Word[], states: Map<string, CardState>, now: number): number {
  return verbs.filter((w) => {
    const s = states.get(ppKey(w.id));
    return s && isDue(s, now);
  }).length;
}

export function countDue(allWords: Word[], states: Map<string, CardState>, now: number): number {
  return allWords.filter((w) => {
    const s = states.get(w.id);
    return s && isDue(s, now);
  }).length;
}

function eligibleExercises(w: Word, opts: SessionOptions): ExerciseType[] {
  const types: ExerciseType[] = ["mc-nl-en", "mc-en-nl"];
  const shortEnough = w.lemma.split(" ").length <= 2 && w.primaryEn.split(" ").length <= 3;
  if (shortEnough) types.push("type-nl");
  if (opts.ttsAvailable) types.push("listen");
  return types;
}

/**
 * Turn a word list into a task queue: a fresh mix of exercise types every
 * round, with an optional tap-the-pairs block when enough words are present.
 * New (never-introduced) words always start with mc-nl-en (recognition first).
 */
export function buildTasks(
  words: Word[],
  states: Map<string, CardState>,
  opts: SessionOptions = {},
): SessionTask[] {
  const rng = opts.rng ?? Math.random;
  const ordered = shuffle(words, rng);
  const tasks: SessionTask[] = ordered.map((word) => {
    if (!states.get(word.id)?.introduced) return { kind: "card", word, exercise: "mc-nl-en" };
    const el = eligibleExercises(word, opts);
    return { kind: "card", word, exercise: el[Math.floor(rng() * el.length)] };
  });
  // Avoid an all-same-type round — but never override the recognition-first
  // rule for new words: only diversify among introduced words.
  const introducedTasks = tasks.filter(
    (t): t is Extract<SessionTask, { kind: "card" }> =>
      t.kind === "card" && Boolean(states.get(t.word.id)?.introduced),
  );
  if (introducedTasks.length > 2 && new Set(introducedTasks.map((t) => t.exercise)).size === 1) {
    introducedTasks[1].exercise = introducedTasks[0].exercise === "mc-en-nl" ? "mc-nl-en" : "mc-en-nl";
  }
  if (opts.includePairs !== false && words.length >= PAIRS_SIZE) {
    const pairWords = shuffle(words, rng).slice(0, Math.min(6, words.length));
    tasks.push({ kind: "pairs", words: pairWords });
  }
  return tasks;
}

/** Distractors from the same chapter (brief §4.3). */
export function pickDistractors(word: Word, pool: Word[], n: number, rng: () => number = Math.random): Word[] {
  const others = pool.filter((w) => w.id !== word.id && w.primaryEn !== word.primaryEn && w.nl !== word.nl);
  return shuffle(others, rng).slice(0, n);
}

/** Map an exercise outcome to an SRS grade (brief §4.1/§4.4). */
export function outcomeToGrade(correct: boolean, usedHint: boolean, elapsedMs: number): Grade {
  if (!correct) return "again";
  if (usedHint) return "hard";
  if (elapsedMs < 5000) return "easy";
  return "good";
}

export const XP_PER_CORRECT = 10;
export const XP_LESSON_BONUS = 20;
