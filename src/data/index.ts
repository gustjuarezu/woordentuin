import type { ChapterMeta, Level, Word } from "./types";
import manifest4 from "./levels/4/manifest.json";
import manifest5 from "./levels/5/manifest.json";

/** The two books the app trains, keyed by course level. */
export const LEVELS: { level: Level; book: string }[] = [
  { level: 4, book: "Nederlands in actie" },
  { level: 5, book: "Nederlands op niveau" },
];

export function bookFor(level: Level): string {
  return LEVELS.find((l) => l.level === level)!.book;
}

// manifest.json + one JSON file per chapter are emitted by the ingestion tools
// (tools/ingest/ingest-book.mjs for level 4, ingest-niveau.mjs for level 5).
// Chapters load on demand.
const files = import.meta.glob<{ default: Word[] }>("./levels/*/hoofdstuk-*.json");

const fileFor = (level: Level, n: number) =>
  `./levels/${level}/hoofdstuk-${String(n).padStart(2, "0")}.json`;

type ManifestEntry = {
  number: number;
  title: string;
  theme: string;
  wordCount: number;
  drillCount?: number;
};

/**
 * The words a chapter actually drills.
 *
 * Nederlands op niveau prints its 0-2000 most frequent words in bold teal, and
 * those are the ones worth learning first, so for every chapter we have tiered
 * (see tools/ingest/niveau/freq-tiers/) the app serves only those. The chapter
 * files keep every printed entry — the participle engine's regression corpus
 * reads them straight off disk, and dropping them would silently shrink its
 * coverage — so the restriction lives here instead, at the one point every
 * screen loads through.
 *
 * To drill a tiered chapter's full list again, return `words` unchanged.
 */
export function drillable(words: Word[]): Word[] {
  const tiered = words.some((w) => w.freqTier);
  return tiered ? words.filter((w) => w.freqTier === "bold") : words;
}

function buildChapters(level: Level, manifest: ManifestEntry[]): ChapterMeta[] {
  return manifest.map((m) => ({
    ...m,
    drillCount: m.drillCount ?? m.wordCount,
    level,
    load: () => files[fileFor(level, m.number)]().then((mod) => drillable(mod.default)),
  }));
}

const chaptersByLevel: Record<Level, ChapterMeta[]> = {
  4: buildChapters(4, manifest4 as ManifestEntry[]),
  5: buildChapters(5, manifest5 as ManifestEntry[]),
};

export function chaptersFor(level: Level): ChapterMeta[] {
  return chaptersByLevel[level];
}

export function chapterMeta(level: Level, n: number): ChapterMeta | undefined {
  return chaptersByLevel[level].find((c) => c.number === n);
}

/** Display label for a chapter, naming its theme, e.g. "Hoofdstuk 10 · Geld". */
export function chapterLabel(m: ChapterMeta): string {
  return `${m.title} · ${m.theme}`;
}

const cache = new Map<string, Promise<Word[]>>();
export function loadChapterWords(level: Level, n: number): Promise<Word[]> {
  const meta = chapterMeta(level, n);
  if (!meta) return Promise.resolve([]);
  const key = `${level}:${n}`;
  if (!cache.has(key)) cache.set(key, meta.load());
  return cache.get(key)!;
}

export function loadAllWords(level: Level): Promise<Word[]> {
  return Promise.all(chaptersByLevel[level].map((c) => loadChapterWords(level, c.number))).then((a) =>
    a.flat(),
  );
}
