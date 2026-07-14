/**
 * SM-2-lite spaced-repetition scheduler (brief §4.1).
 *
 * Choice documented: plain SM-2-lite over FSRS — the grading signal here is
 * coarse (four outcomes derived from exercise results), the deck is small
 * (dozens of words per chapter), and SM-2-lite is trivially testable and
 * explainable. FSRS would add parameters without observable benefit at this
 * scale; the interface below (gradeCard) would let it be swapped in later.
 */

export type Grade = "again" | "hard" | "good" | "easy";

export interface CardState {
  wordId: string;
  ease: number;        // start 2.5, floor 1.3
  intervalDays: number;
  due: number;         // epoch ms
  reps: number;
  lapses: number;
  introduced: boolean;
}

export const EASE_START = 2.5;
export const EASE_FLOOR = 1.3;
const DAY_MS = 86_400_000;
/** "again" requeues within the session; between sessions it comes back fast. */
const AGAIN_INTERVAL_DAYS = 1 / 144; // 10 minutes

export function newCardState(wordId: string): CardState {
  return { wordId, ease: EASE_START, intervalDays: 0, due: 0, reps: 0, lapses: 0, introduced: false };
}

export function gradeCard(prev: CardState, grade: Grade, now: number): CardState {
  const s: CardState = { ...prev, introduced: true };
  switch (grade) {
    case "again":
      s.lapses = prev.lapses + 1;
      s.reps = 0;
      s.ease = Math.max(EASE_FLOOR, prev.ease - 0.2);
      s.intervalDays = AGAIN_INTERVAL_DAYS;
      break;
    case "hard":
      s.ease = Math.max(EASE_FLOOR, prev.ease - 0.15);
      s.intervalDays = Math.max(AGAIN_INTERVAL_DAYS, prev.intervalDays * 1.2);
      break;
    case "good":
    case "easy": {
      let interval: number;
      if (prev.reps === 0) interval = 1;
      else if (prev.reps === 1) interval = 3;
      else interval = prev.intervalDays * prev.ease;
      if (grade === "easy") {
        interval *= 1.3;
        s.ease = prev.ease + 0.15;
      }
      s.intervalDays = interval;
      s.reps = prev.reps + 1;
      break;
    }
  }
  s.due = now + s.intervalDays * DAY_MS;
  return s;
}

export function isDue(s: CardState, now: number): boolean {
  return s.introduced && s.due <= now;
}

/** Growth stage for the garden (0 seed … 5 bloom), from interval thresholds. */
export function growthStage(s: CardState | undefined): number {
  if (!s || !s.introduced) return 0;
  const d = s.intervalDays;
  if (d >= 21) return 5;
  if (d >= 7) return 4;
  if (d >= 3) return 3;
  if (d >= 1) return 2;
  return 1;
}

export const STAGE_MAX = 5;

/** Unit crown level names tied to the garden metaphor (brief §4.2). */
export const CROWN_LEVELS = ["Seedling", "Sprout", "Leaf", "Flower", "Bloom"] as const;

/** Crown level of a unit: share of words whose stage crossed rising thresholds. */
export function crownLevel(stages: number[]): number {
  if (!stages.length) return 0;
  const share = (min: number) => stages.filter((s) => s >= min).length / stages.length;
  let level = 0;
  if (share(1) >= 0.8) level = 1;
  if (share(2) >= 0.8) level = 2;
  if (share(3) >= 0.8) level = 3;
  if (share(4) >= 0.8) level = 4;
  if (share(5) >= 0.9) level = 5;
  return level;
}
