import { create } from "zustand";
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

interface AppState {
  ready: boolean;
  cardStates: Map<string, CardState>;
  profile: Profile;
  settings: Settings;
  init: () => Promise<void>;
  grade: (wordId: string, grade: Grade, now?: number) => CardState;
  addXp: (n: number) => void;
  bumpStreak: (now?: number) => void;
  noteIntroduced: (chapter: number, count: number, now?: number) => void;
  newRemainingToday: (chapter: number, now?: number) => number;
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

  noteIntroduced: (chapter, count, now = Date.now()) => {
    const p = get().profile;
    const today = todayStr(now);
    const byChapter = p.introducedDay === today ? { ...p.introducedByChapter } : {};
    byChapter[chapter] = (byChapter[chapter] ?? 0) + count;
    const profile = { ...p, introducedDay: today, introducedByChapter: byChapter };
    set({ profile });
    void storage.saveProfile(profile);
  },

  newRemainingToday: (chapter, now = Date.now()) => {
    const { profile, settings } = get();
    const used = profile.introducedDay === todayStr(now) ? (profile.introducedByChapter[chapter] ?? 0) : 0;
    return Math.max(0, settings.newPerDay - used);
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
