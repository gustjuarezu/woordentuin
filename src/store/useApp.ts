import { create } from "zustand";
import type { Level } from "../data/types";
import type { CardState, Grade } from "../engine/srs";
import { gradeCard, newCardState } from "../engine/srs";
import {
  createStorage,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  type Profile,
  type Settings,
} from "./storage";

const storage = createStorage();

export function todayStr(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Daily new-word counters are per level AND chapter (both books have a
 * hoofdstuk 1–6, so a bare chapter number would collide). */
export const throttleKey = (level: Level, chapter: number) => `${level}:${chapter}`;

/** Active level for content pages. Defaults to 4 until the picker has run —
 * that matches installs that predate the level feature. */
export const useLevel = (): Level => useApp((s) => s.settings.level ?? 4);

interface AppState {
  ready: boolean;
  cardStates: Map<string, CardState>;
  profile: Profile;
  settings: Settings;
  init: () => Promise<void>;
  grade: (wordId: string, grade: Grade, now?: number) => CardState;
  addXp: (n: number) => void;
  bumpStreak: (now?: number) => void;
  noteIntroduced: (key: string, count: number, now?: number) => void;
  newRemainingToday: (key: string, now?: number) => number;
  setLevel: (level: Level) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  resetProgress: () => Promise<void>;
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  cardStates: new Map(),
  profile: { ...DEFAULT_PROFILE },
  settings: { ...DEFAULT_SETTINGS },

  init: async () => {
    if (get().ready) return;
    const [cards, profile, settings] = await Promise.all([
      storage.loadCardStates(),
      storage.loadProfile(),
      storage.loadSettings(),
    ]);
    set({
      ready: true,
      cardStates: new Map(cards.map((c) => [c.wordId, c])),
      profile,
      settings,
    });
  },

  grade: (wordId, grade, now = Date.now()) => {
    const prev = get().cardStates.get(wordId) ?? newCardState(wordId);
    const next = gradeCard(prev, grade, now);
    const cardStates = new Map(get().cardStates);
    cardStates.set(wordId, next);
    set({ cardStates });
    void storage.saveCardState(next);
    return next;
  },

  addXp: (n) => {
    const profile = { ...get().profile, xp: get().profile.xp + n };
    set({ profile });
    void storage.saveProfile(profile);
  },

  bumpStreak: (now = Date.now()) => {
    const p = get().profile;
    const today = todayStr(now);
    if (p.lastDay === today) return;
    const yesterday = todayStr(now - 86_400_000);
    const profile = { ...p, streak: p.lastDay === yesterday ? p.streak + 1 : 1, lastDay: today };
    set({ profile });
    void storage.saveProfile(profile);
  },

  noteIntroduced: (key, count, now = Date.now()) => {
    const p = get().profile;
    const today = todayStr(now);
    const byChapter = p.introducedDay === today ? { ...p.introducedByChapter } : {};
    byChapter[key] = (byChapter[key] ?? 0) + count;
    const profile = { ...p, introducedDay: today, introducedByChapter: byChapter };
    set({ profile });
    void storage.saveProfile(profile);
  },

  newRemainingToday: (key, now = Date.now()) => {
    const { profile, settings } = get();
    const used = profile.introducedDay === todayStr(now) ? (profile.introducedByChapter[key] ?? 0) : 0;
    return Math.max(0, settings.newPerDay - used);
  },

  setLevel: (level) => {
    const settings = { ...get().settings, level };
    set({ settings });
    void storage.saveSettings(settings);
  },

  updateSettings: (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    void storage.saveSettings(settings);
  },

  resetProgress: async () => {
    await storage.resetProgress();
    set({ cardStates: new Map(), profile: { ...DEFAULT_PROFILE } });
  },
}));
