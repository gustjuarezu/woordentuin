#!/usr/bin/env node
/**
 * One-off (re-runnable) migration: extract the CHAPTERS object from the
 * prototype reference/woordentuin.html and emit rich-schema chapter JSON
 * (src/data/chapters/hoofdstuk-NN.json) per the build brief §3.
 *
 * The prototype data is flat ({nl, en, hint?, note?, star?, example?});
 * this script derives id/lemma/article/pos/reflexive/separable and splits
 * glosses. Part-of-speech for non-noun/non-verb words can't be derived
 * mechanically, so a hand-checked override map covers H7/H8.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const html = readFileSync(join(root, "reference", "woordentuin.html"), "utf8");

const m = html.match(/const CHAPTERS = (\{[\s\S]*?\n\});\n/);
if (!m) throw new Error("CHAPTERS object not found in prototype");
const CHAPTERS = new Function(`return ${m[1]}`)();

// Hand-checked pos for words that are neither articled nouns nor "to …" verbs.
const POS_OVERRIDES = {
  bijvoorbeeld: "adverb", bovendien: "adverb", contraproductief: "adjective",
  daadwerkelijk: "adverb", daarnaast: "adverb", doordat: "other",
  gelijk: "adjective", gestaag: "adjective", langzamerhand: "adverb",
  ontevreden: "adjective", ronduit: "adverb", tevreden: "adjective",
  vlak: "adjective", zoiets: "other",
  milieubewust: "adjective", ondertussen: "adverb", apart: "adjective",
  echter: "adverb", trouwens: "adverb", uiteindelijk: "adverb",
  duurzaam: "adjective", buitenlands: "adjective",
};

const slug = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function migrateWord(chapter, raw) {
  const { nl, en, hint, note, star, example } = raw;
  const glosses = en.split(/;/).map((g) => g.trim()).filter(Boolean);
  const w = {
    id: `h${chapter}-${slug(nl)}`,
    chapter,
    nl,
    lemma: nl,
    pos: "other",
    en: glosses,
    primaryEn: glosses[0],
    source: star ? "struikelwoorden" : "vocabulaire-list",
  };

  const nounMatch = nl.match(/^(de|het) (\S+)$/);
  const firstGloss = glosses[0];
  if (nounMatch) {
    w.article = nounMatch[1];
    w.lemma = nounMatch[2];
    w.pos = "noun";
  } else if (nl.startsWith("zich ") && nl.split(" ").length === 2) {
    w.reflexive = true;
    w.lemma = nl.slice(5);
    w.pos = "verb";
  } else if (!nl.includes(" ") && firstGloss.startsWith("to ")) {
    w.pos = "verb";
  } else if (nl.includes(" ")) {
    w.pos = "phrase";
  }
  if (POS_OVERRIDES[nl]) w.pos = POS_OVERRIDES[nl];

  if (hint) w.hint = hint;
  if (hint && /\S+ … \S+/.test(hint) && w.pos === "verb") w.separable = true;
  if (note) w.note = note;
  if (star) w.struikelwoord = true;
  if (example) w.examples = [example];
  return w;
}

const outDir = join(root, "src", "data", "chapters");
mkdirSync(outDir, { recursive: true });
for (const [ch, data] of Object.entries(CHAPTERS)) {
  const words = data.words.map((raw) => migrateWord(Number(ch), raw));
  const ids = new Set(words.map((w) => w.id));
  if (ids.size !== words.length) throw new Error(`duplicate ids in chapter ${ch}`);
  const file = join(outDir, `hoofdstuk-${String(ch).padStart(2, "0")}.json`);
  writeFileSync(file, JSON.stringify(words, null, 2) + "\n");
  console.log(`${file}: ${words.length} words (${data.theme})`);
}
