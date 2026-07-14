import { describe, expect, it } from "vitest";
import { CROWN_LEVELS, EASE_FLOOR, EASE_START, crownLevel, gradeCard, growthStage, isDue, newCardState } from "./srs";

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

describe("gradeCard", () => {
  it("first good answer → 1 day", () => {
    const s = gradeCard(newCardState("w"), "good", NOW);
    expect(s.intervalDays).toBe(1);
    expect(s.reps).toBe(1);
    expect(s.due).toBe(NOW + DAY);
    expect(s.introduced).toBe(true);
  });

  it("second good answer → 3 days, then multiplies by ease", () => {
    let s = gradeCard(newCardState("w"), "good", NOW);
    s = gradeCard(s, "good", NOW);
    expect(s.intervalDays).toBe(3);
    s = gradeCard(s, "good", NOW);
    expect(s.intervalDays).toBeCloseTo(3 * EASE_START);
  });

  it("easy multiplies by 1.3 and raises ease", () => {
    const s = gradeCard(newCardState("w"), "easy", NOW);
    expect(s.intervalDays).toBeCloseTo(1.3);
    expect(s.ease).toBeCloseTo(EASE_START + 0.15);
  });

  it("hard grows interval slowly and lowers ease, never full mastery via hints", () => {
    let s = gradeCard(newCardState("w"), "good", NOW); // 1d
    s = gradeCard(s, "hard", NOW);
    expect(s.intervalDays).toBeCloseTo(1.2);
    expect(s.ease).toBeCloseTo(EASE_START - 0.15);
    expect(s.reps).toBe(1); // hard does not advance reps
  });

  it("again resets reps, counts a lapse, requeues fast", () => {
    let s = gradeCard(newCardState("w"), "good", NOW);
    s = gradeCard(s, "good", NOW);
    s = gradeCard(s, "again", NOW);
    expect(s.reps).toBe(0);
    expect(s.lapses).toBe(1);
    expect(s.intervalDays).toBeLessThan(0.01);
    expect(s.due).toBeGreaterThan(NOW);
    expect(s.due - NOW).toBeLessThan(DAY);
  });

  it("ease never drops below the floor", () => {
    let s = newCardState("w");
    for (let i = 0; i < 20; i++) s = gradeCard(s, "again", NOW);
    expect(s.ease).toBeCloseTo(EASE_FLOOR);
  });
});

describe("isDue", () => {
  it("unintroduced cards are never due", () => {
    expect(isDue(newCardState("w"), NOW)).toBe(false);
  });
  it("due when due date passed", () => {
    const s = gradeCard(newCardState("w"), "good", NOW);
    expect(isDue(s, NOW + DAY - 1)).toBe(false);
    expect(isDue(s, NOW + DAY)).toBe(true);
  });
});

describe("growthStage", () => {
  it("maps interval thresholds to stages 0–5", () => {
    expect(growthStage(undefined)).toBe(0);
    expect(growthStage(newCardState("w"))).toBe(0);
    const at = (intervalDays: number) => growthStage({ ...newCardState("w"), introduced: true, intervalDays });
    expect(at(0)).toBe(1);
    expect(at(1)).toBe(2);
    expect(at(3)).toBe(3);
    expect(at(7)).toBe(4);
    expect(at(21)).toBe(5);
  });
});

describe("crownLevel", () => {
  it("has five named levels", () => {
    expect(CROWN_LEVELS).toHaveLength(5);
  });
  it("rises as the garden matures", () => {
    expect(crownLevel([0, 0, 0, 0])).toBe(0);
    expect(crownLevel([1, 1, 1, 1, 0])).toBe(1);
    expect(crownLevel([5, 5, 5, 5, 5])).toBe(5);
    expect(crownLevel([])).toBe(0);
  });
});
