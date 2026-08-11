#!/usr/bin/env node
/**
 * Level-5 ingestion: Nederlands op niveau → src/data/levels/5/.
 *
 * Unlike Nederlands in actie, this book is a scanned PDF and prints NO English
 * translations — the per-chapter source files in tools/ingest/niveau/ are
 * hand/agent-transcribed from the end-of-chapter "Vocabulairelijst" pages
 * (images + OCR cross-check), with English glosses authored by us and audited
 * in the *_review.md files. This script only normalizes those sources into the
 * app's Word schema: it assigns ids (n<chapter>-<slug>, distinct from level
 * 4's h<chapter>- ids), dedupes, and emits chapter JSONs + manifest.
 *
 * Usage: node tools/ingest/ingest-niveau.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "niveau");
const outDir = join(here, "..", "..", "src", "data", "levels", "5");
const reviewDir = join(here, "review");

const slug = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim();

mkdirSync(outDir, { recursive: true });
mkdirSync(reviewDir, { recursive: true });

const manifest = [];
for (let n = 1; n <= 6; n++) {
  const file = join(srcDir, `hoofdstuk-${String(n).padStart(2, "0")}.json`);
  if (!existsSync(file)) {
    console.error(`missing source ${file} — run the transcription first`);
    process.exit(1);
  }
  const src = JSON.parse(readFileSync(file, "utf8"));
  const warnings = [...(src.warnings ?? [])];

  const words = [];
  const seen = new Map();
  for (const s of src.words) {
    const nl = s.nl.replace(/\s+/g, " ").trim();
    if (seen.has(norm(nl))) {
      warnings.push(`duplicate entry dropped: ${nl}`);
      continue;
    }
    let id = `n${n}-${slug(nl)}`;
    if (words.some((w) => w.id === id)) id = `${id}-2`;
    // Level-4 convention: multi-word entries are phrases unless they start
    // with "zich" — this also keeps prep-combos ("denken aan") out of the
    // participle drill, whose derivation only fits single verbs.
    let pos = s.pos;
    if (pos === "verb" && nl.includes(" ") && !/^zich /.test(nl)) pos = "phrase";
    const w = {
      id,
      chapter: n,
      nl,
      lemma: (s.lemma ?? nl).replace(/^(de|het|een|zich) /, "").trim(),
      pos,
      en: s.en,
      primaryEn: s.primaryEn ?? s.en[0],
      source: "generated", // glosses are ours, not the book's (it prints none)
    };
    if (s.article) {
      w.article = s.article;
      w.pos = "noun";
    }
    if (s.reflexive) w.reflexive = true;
    if (s.separable) w.separable = true;
    if (s.irregular && (s.irregular.past || s.irregular.perfect)) w.irregular = s.irregular;
    if (s.hint) w.hint = s.hint;
    if (s.note) w.note = s.note;
    if (Array.isArray(s.examples) && s.examples.length) w.examples = s.examples.slice(0, 2);
    if (!w.en?.length || w.en.some((g) => !g?.trim())) {
      warnings.push(`bad glosses for ${nl}`);
      continue;
    }
    if (!w.en.includes(w.primaryEn)) w.primaryEn = w.en[0];
    seen.set(norm(nl), w);
    words.push(w);
  }

  writeFileSync(
    join(outDir, `hoofdstuk-${String(n).padStart(2, "0")}.json`),
    JSON.stringify(words, null, 2) + "\n",
  );
  manifest.push({ number: n, title: `Hoofdstuk ${n}`, theme: src.theme, wordCount: words.length });

  const md = [
    `# Niveau hoofdstuk ${n} — ${src.theme}: review`,
    "",
    `${words.length} words. ALL glosses are generated (the book prints none) — audit below.`,
    "",
    "## gloss audit list",
    ...words.map((w) => `- **${w.nl}** → ${w.en.join("; ")}${w.irregular ? ` _(irr: ${w.irregular.past} / ${w.irregular.perfect})_` : ""}`),
    "",
    "## warnings",
    ...warnings.map((w) => `- ${w}`),
    "",
  ].join("\n");
  writeFileSync(join(reviewDir, `niveau-hoofdstuk-${String(n).padStart(2, "0")}_review.md`), md);
  console.log(`n${n} ${src.theme}: ${words.length} words, ${warnings.length} warnings`);
}

writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("level-5 manifest written");
