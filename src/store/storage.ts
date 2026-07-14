/**
 * Persistence behind a swappable interface (brief §2): IndexedDB via Dexie,
 * with an in-memory fallback when IndexedDB is unavailable. Never
 * localStorage — it is partitioned/blocked in sandboxed iframes on iOS.
 */
import Dexie, { type Table } from "dexie";
import type { CardState } from "../engine/srs";

export interface Profile {
  xp: number;
  streak: number;
  lastDay: string | null;           // YYYY-MM-DD of last completed session
  introducedDay: string | null;     // day the counters below belong to
  introducedByChapter: Record<number, number>;
}

export interface Settings {
  newPerDay: number;        // new-card throttle per chapter per day
  lessonSize: number;
  hearts: boolean;          // Duolingo-style lives, default OFF (brief §4.5)
  audioOnProduction: boolean; // allow speaker on cards where you must produce Dutch
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 8,
  lessonSize: 7,
  hearts: false,
  audioOnProduction: false,
};

export const DEFAULT_PROFILE: Profile = {
  xp: 0,
  streak: 0,
  lastDay: null,
  introducedDay: null,
  introducedByChapter: {},
};

export interface StorageBackend {
  loadCardStates(): Promise<CardState[]>;
  saveCardState(state: CardState): Promise<void>;
  loadProfile(): Promise<Profile>;
  saveProfile(p: Profile): Promise<void>;
  loadSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
  resetProgress(): Promise<void>;
}

class WoordentuinDB extends Dexie {
  cardStates!: Table<CardState, string>;
  kv!: Table<{ key: string; value: unknown }, string>;
  constructor() {
    super("woordentuin");
    this.version(1).stores({ cardStates: "wordId", kv: "key" });
  }
}

class DexieStorage implements StorageBackend {
  private db = new WoordentuinDB();
  loadCardStates() {
    return this.db.cardStates.toArray();
  }
  saveCardState(state: CardState) {
    return this.db.cardStates.put(state).then(() => undefined);
  }
  async loadProfile() {
    const row = await this.db.kv.get("profile");
    return { ...DEFAULT_PROFILE, ...((row?.value as Partial<Profile>) ?? {}) };
  }
  saveProfile(p: Profile) {
    return this.db.kv.put({ key: "profile", value: p }).then(() => undefined);
  }
  async loadSettings() {
    const row = await this.db.kv.get("settings");
    return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
  }
  saveSettings(s: Settings) {
    return this.db.kv.put({ key: "settings", value: s }).then(() => undefined);
  }
  async resetProgress() {
    await this.db.cardStates.clear();
    await this.db.kv.delete("profile");
  }
}

class MemoryStorage implements StorageBackend {
  private cards = new Map<string, CardState>();
  private profile = { ...DEFAULT_PROFILE };
  private settings = { ...DEFAULT_SETTINGS };
  async loadCardStates() { return [...this.cards.values()]; }
  async saveCardState(s: CardState) { this.cards.set(s.wordId, s); }
  async loadProfile() { return { ...this.profile }; }
  async saveProfile(p: Profile) { this.profile = p; }
  async loadSettings() { return { ...this.settings }; }
  async saveSettings(s: Settings) { this.settings = s; }
  async resetProgress() { this.cards.clear(); this.profile = { ...DEFAULT_PROFILE }; }
}

export function createStorage(): StorageBackend {
  try {
    if (typeof indexedDB !== "undefined") return new DexieStorage();
  } catch {
    /* fall through */
  }
  return new MemoryStorage();
}
