import type { ChapterMeta, Word } from "./types";

// One JSON file per chapter, loaded on demand. Add new chapters here after
// running the ingestion tool (tools/ingest).
export const chapters: ChapterMeta[] = [
  {
    number: 7,
    title: "Hoofdstuk 7",
    theme: "Nederlands leren",
    wordCount: 72,
    load: () => import("./chapters/hoofdstuk-07.json").then((m) => m.default as Word[]),
  },
  {
    number: 8,
    title: "Hoofdstuk 8",
    theme: "Duurzaamheid",
    wordCount: 71,
    load: () => import("./chapters/hoofdstuk-08.json").then((m) => m.default as Word[]),
  },
];

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
