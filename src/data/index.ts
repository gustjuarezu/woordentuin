import type { ChapterMeta, Word } from "./types";
import manifest from "./chapters/manifest.json";

// manifest.json + one JSON file per chapter are emitted by the ingestion tool
// (tools/ingest/ingest-book.mjs). Chapters load on demand.
const files = import.meta.glob<{ default: Word[] }>("./chapters/hoofdstuk-*.json");

const fileFor = (n: number) => `./chapters/hoofdstuk-${String(n).padStart(2, "0")}.json`;

export const chapters: ChapterMeta[] = (
  manifest as { number: number; title: string; theme: string; wordCount: number }[]
).map((m) => ({
  ...m,
  load: () => files[fileFor(m.number)]().then((mod) => mod.default),
}));

export function chapterMeta(n: number): ChapterMeta | undefined {
  return chapters.find((c) => c.number === n);
}

const cache = new Map<number, Promise<Word[]>>();
export function loadChapterWords(n: number): Promise<Word[]> {
  const meta = chapterMeta(n);
  if (!meta) return Promise.resolve([]);
  if (!cache.has(n)) cache.set(n, meta.load());
  return cache.get(n)!;
}

export function loadAllWords(): Promise<Word[]> {
  return Promise.all(chapters.map((c) => loadChapterWords(c.number))).then((a) => a.flat());
}
