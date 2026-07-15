#!/usr/bin/env node
/**
 * Ingestion pipeline (brief §5): Nederlands in actie PDF → per-chapter JSON.
 *
 * Sources reconciled per chapter:
 *  1. In-chapter two-column "Vocabulaire" lists (NL \t EN) — authoritative English.
 *  2. "Struikelwoorden" sections — example sentences for * words.
 *  3. End-of-chapter "Vocabulaire hoofdstuk N" index — canonical lemmas, Idioom,
 *     Preposities, Onregelmatige werkwoorden, Scheidbare werkwoorden.
 * Words that exist only in the Dutch-only index/Idioom get their gloss from
 * generated-glosses.json (human-supplied) and are flagged needsReview.
 *
 * Usage: node tools/ingest/ingest-book.mjs [--pdf reference/Nederlands_in_actie.pdf]
 * Re-runnable; extraction is cached in tools/ingest/.cache/book.txt.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const pdfPath = process.argv.includes("--pdf")
  ? process.argv[process.argv.indexOf("--pdf") + 1]
  : join(root, "reference", "Nederlands_in_actie.pdf");
const cacheDir = join(here, ".cache");
const cacheFile = join(cacheDir, "book.txt");
const reviewDir = join(here, "review");
const outDir = join(root, "src", "data", "chapters");

// ---------------------------------------------------------------- extraction

async function extractText() {
  if (existsSync(cacheFile)) return readFileSync(cacheFile, "utf8");
  const { PDFParse } = require("pdf-parse");
  const parser = new PDFParse({ data: readFileSync(pdfPath) });
  const r = await parser.getText();
  const out = r.pages.map((p, i) => `=== PAGE ${i + 1} ===\n` + p.text).join("\n");
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(cacheFile, out);
  return out;
}

// ------------------------------------------------------------------ helpers

const DASH = /\s+[‒–—-]\s+/; // principal-part separator in irregular verbs
const slug = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const norm = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim();

/** crude EN/NL line classifier for wrapped/stacked vocab rows */
function looksEnglish(line) {
  const l = line.trim().toLowerCase();
  if (/^(to|the|a|an|as|hier:|also|so|at|by|i'?m|it'?s|you|not|no|yes|on|in|of|for|with|about|something|someone|somebody)\b/.test(l)) return true;
  if (/^\(/.test(l)) return true; // continuation like "(that), to notice"
  if (/\b(the|of|to|for|with|your|you|something|someone|about)\b/.test(l)) return true;
  return false;
}

/** Dutch headword-ish line: starts with an article/particle or carries Dutch
 * morphology. Used to find the NL→EN boundary in stacked rows. */
function looksDutch(line) {
  const l = line.trim().toLowerCase().replace(/[*()]/g, " ").trim();
  if (/^(de|het|een|zich|naar|om|op|er|ten|voor|aan|in|met|iets|niet|geen|wat|hoe|je|ik)\b/.test(l)) return true;
  if (/(en|tje|heid|lijk|ing|isch|schap)$/.test(l.split(/\s+/).pop() ?? "")) return true;
  if (/…|‒/.test(l)) return true;
  return false;
}

function balancedParens(s) {
  let d = 0;
  for (const ch of s) {
    if (ch === "(") d++;
    else if (ch === ")") d--;
  }
  return d === 0;
}

/** top-level parenthesized groups + the text outside them */
function parenSplit(s) {
  const groups = [];
  let base = "";
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") {
      if (depth === 0) cur = "";
      else cur += ch;
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) groups.push(cur.trim());
      else cur += ch;
    } else if (depth > 0) cur += ch;
    else base += ch;
  }
  return { base: base.replace(/\s+/g, " ").trim(), groups };
}

// ------------------------------------------------------------- index parser

/** "aanleiding, de (de ‒ (tot / voor))" → {nl:"de aanleiding", usage:"de aanleiding (tot / voor)"}
 *  "heen, om me ‒" → {nl:"om me heen"}; "(het) plastic" → {nl:"het plastic"} */
function parseIndexLemma(raw) {
  let s = raw.trim().replace(/[–—]/g, "‒").replace(/,\s*$/, "");
  if (!s) return null;
  let usage = null;
  const { base, groups } = parenSplit(s);
  if (groups.length && /^(het|de|een|zich)$/.test(groups[0]) && base && !/[,‒]/.test(base)) {
    // "(het) plastic" and "ideaal, (het)" / "ontspannen, (zich)" — the
    // article/particle is optional in the book's notation
    return { nl: `${groups[0]} ${base}`.trim(), usage: null };
  }
  s = (base || s).replace(/,\s*$/, "");
  if (groups.length) usage = groups.join("; ");
  const m = s.match(/^(.+),\s*(.+)$/);
  let nl;
  if (m) {
    const head = m[1].trim();
    const tail = m[2].trim();
    if (tail.includes("‒")) nl = tail.replace("‒", head);
    else if (/^(de|het|een|zich)$/.test(tail)) nl = `${tail} ${head}`;
    else nl = head; // alternative spellings: "ten slotte, tenslotte"
  } else {
    nl = s;
  }
  nl = nl.replace(/\s+/g, " ").trim();
  if (usage) usage = usage.replace(/‒/g, nl.replace(/^(de|het|een) /, "")).replace(/\s+/g, " ").trim();
  return { nl, usage };
}

// -------------------------------------------------------------- list parser

/** Split a line that lost its column tab: "surface (lemma) english gloss".
 * Returns [nl, en] at the first top-level ")" followed by English-looking
 * text, or null. */
function splitGlued(t, isCanonText) {
  let depth = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "(") depth++;
    else if (t[i] === ")") {
      depth--;
      if (depth === 0) {
        const rest = t.slice(i + 1).trim();
        if (rest.length >= 3 && !rest.startsWith("(")) {
          const head = t.slice(0, i + 1).trim();
          if (looksEnglish(rest) || (!looksDutch(rest) && isCanonText(head))) return [head, rest];
        }
      }
    }
  }
  return null;
}

/** Parse one two-column vocab block into raw {nlRaw, enRaw} rows. */
function parseVocabBlock(lines, isCanonText, warnings) {
  const rows = [];
  let pendingNoTab = [];

  const flushRun = () => {
    if (!pendingNoTab.length) return;
    // 1) merge lines with unbalanced parens (de-hyphenating wraps)
    const merged = [];
    for (const l of pendingNoTab) {
      if (merged.length && !balancedParens(merged[merged.length - 1])) {
        merged[merged.length - 1] = (merged[merged.length - 1] + " " + l).replace(/(\w)- (?=\w)/g, "$1");
      } else merged.push(l);
    }
    // 1b) a merged line may be a glued tabless row: "surface (lemma) english"
    for (let i = merged.length - 1; i >= 0; i--) {
      if (!balancedParens(merged[i])) continue;
      const split = splitGlued(merged[i], isCanonText);
      if (split) {
        merged.splice(i, 1);
        rows.push({ nlRaw: split[0], enRaw: split[1] });
      }
    }
    if (!merged.length) {
      pendingNoTab = [];
      return;
    }
    // 1c) full sentences are stray reading-text, never glosses — drop them
    for (let i = merged.length - 1; i >= 0; i--) {
      if (/[.?!]$/.test(merged[i])) {
        warnings.push(`stray sentence dropped: ${merged[i].slice(0, 60)}`);
        merged.splice(i, 1);
      }
    }
    if (!merged.length) {
      pendingNoTab = [];
      return;
    }
    // 1d) legit stacked runs are at most ~4 lines; anything bigger is a
    //     text/cartoon block that shares the page with the vocab list
    if (merged.length > 6) {
      warnings.push(`oversized run dropped (${merged.length} lines): ${merged[0].slice(0, 50)}…`);
      pendingNoTab = [];
      return;
    }
    // 2) classify: an index (canon) match or a "surface (lemma)" paren group
    //    pins a line to the NL side; explicit English wins next; Dutch
    //    morphology keeps it NL; the rest fall to EN.
    const flags = merged.map(
      (l) => !(isCanonText(l) || (!looksEnglish(l) && (looksDutch(l) || /\(.+\)/.test(l)))),
    );
    const firstEn = flags.indexOf(true);
    if (firstEn === -1) {
      warnings.push(`unpaired Dutch lines dropped: ${merged.join(" | ")}`);
      pendingNoTab = [];
      return;
    }
    if (firstEn === 0) {
      // all-EN continuation of the previous row
      if (rows.length) rows[rows.length - 1].enRaw += " " + merged.join(" ");
      else warnings.push(`dangling English lines: ${merged.join(" | ")}`);
      pendingNoTab = [];
      return;
    }
    const nls = merged.slice(0, firstEn);
    const ens = merged.slice(firstEn);
    if (ens.some((e, i) => i > 0 && !looksEnglish(e))) {
      warnings.push(`mixed run, best-effort pairing: ${merged.join(" | ")}`);
    }
    if (nls.length === ens.length) {
      nls.forEach((nl, i) => rows.push({ nlRaw: nl, enRaw: ens[i] }));
    } else {
      rows.push({ nlRaw: nls.join(" "), enRaw: ens.join(" ") });
    }
    pendingNoTab = [];
  };

  for (const line of lines) {
    if (line.includes("\t")) {
      const [nlRaw, ...rest] = line.split("\t");
      flushRun();
      rows.push({ nlRaw: nlRaw.trim(), enRaw: rest.join(" ").trim() });
      continue;
    }
    // Some rows lose their tab in PDF extraction: "surface (lemma) english".
    const t = line.trim();
    if (balancedParens(t)) {
      const split = splitGlued(t, isCanonText);
      if (split) {
        flushRun();
        rows.push({ nlRaw: split[0], enRaw: split[1] });
        continue;
      }
    }
    pendingNoTab.push(t);
  }
  flushRun();
  return rows.filter((r) => r.nlRaw && r.enRaw);
}

/** Split an English cell into glosses (+ note when the book says "hier: … ook: …"). */
function parseEnglish(enRaw) {
  let note;
  let s = enRaw.replace(/\s+/g, " ").trim();
  if (/hier:/.test(s)) {
    note = s;
    s = s.replace(/hier:\s*/g, "").replace(/,?\s*ook:\s*/g, ", ");
  }
  // split on top-level commas
  const glosses = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      glosses.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  glosses.push(cur.trim());
  const out = [];
  for (let g of glosses) {
    if (!g) continue;
    // "separate(ly)" / "exact(ly)" → both forms; "(I'm sorry)" tail → keep whole
    const ly = g.match(/^([a-z]+)\((ly|s)\)$/i);
    if (ly) {
      out.push(ly[1], ly[1] + ly[2]);
      continue;
    }
    out.push(g);
  }
  return { glosses: [...new Set(out)].filter(Boolean), note };
}

// ------------------------------------------------------------- main parsing

const STOP_HEADING = /^(Struikelwoord(en)?$|Opdracht|Grammatica|Uitspraak|Schrijfwijzer|Tekst|Vocabulaire$|Vocabulaire hoofdstuk|\d+\.\d+\s)/;

function parseChapter(chLines, n, theme, glossOverrides, warnings) {
  // strip page artifacts and reading-text line counters
  const lines = chLines.filter(
    (l) => !/^=== PAGE \d+ ===$/.test(l) && !/^\d+$/.test(l.trim()) && !/^Hoofdstuk \d+ \| /.test(l) && l.trim() !== "",
  );

  const idxStart = lines.findIndex((l) => l.trim() === `Vocabulaire hoofdstuk ${n}`);
  const main = idxStart === -1 ? lines : lines.slice(0, idxStart);
  const idx = idxStart === -1 ? [] : lines.slice(idxStart + 1);
  if (idxStart === -1) warnings.push(`no end-of-chapter index found for hoofdstuk ${n}`);

  // ---- end-of-chapter index sections
  const sections = { Idioom: [], Vocabulaire: [], Preposities: [], "Onregelmatige werkwoorden": [], "Scheidbare werkwoorden": [] };
  // Some chapters have no Idioom block and start the alphabetical list
  // immediately, without a "Vocabulaire" subheader.
  let cur = "Vocabulaire";
  for (const l of idx) {
    const t = l.trim();
    if (t === "Eigen vocabulaire") break;
    if (t in sections) {
      cur = t;
      continue;
    }
    if (cur) sections[cur].push(t);
  }
  const indexLemmas = sections.Vocabulaire.map((l) => parseIndexLemma(l)).filter(Boolean);
  const idioms = sections.Idioom.map((l) => l.trim()).filter(Boolean);
  const separable = new Set(sections["Scheidbare werkwoorden"].map((l) => norm(l)));
  const irregular = new Map();
  {
    // records wrap across lines ("flauwvallen ‒ viel flauw ‒" / "is flauwgevallen"):
    // a record is complete once it has ≥2 separators and doesn't end in a dash
    const records = [];
    for (const raw of sections["Onregelmatige werkwoorden"]) {
      const l = raw.trim();
      if (!l) continue;
      const prev = records[records.length - 1];
      const incomplete = prev !== undefined && (prev.split(DASH).length < 3 || /[‒–—-]\s*$/.test(prev));
      if (incomplete) records[records.length - 1] += " " + l;
      else records.push(l);
    }
    for (const l of records) {
      const parts = l.split(DASH).map((p) => p.trim());
      if (parts.length >= 3) {
        irregular.set(norm(parts[0].replace(/\s*\(.*\)$/, "")), { past: parts[1], perfect: parts.slice(2).join(" ") });
      } else if (l.trim()) warnings.push(`unparsed irregular verb line: ${l}`);
    }
  }

  // canonical lookup: normalized lemma → index entry
  const canon = new Map();
  for (const e of indexLemmas) {
    canon.set(norm(e.nl), e);
    canon.set(norm(e.nl.replace(/^(de|het|een|zich) /, "")), e);
  }

  // ---- in-chapter vocab blocks
  const PREP = "(naar|van|op|met|aan|voor|in|tot|over|uit|bij|om|door)";
  const isCanonText = (text) => {
    const clean = text.replace(/(\w)- (?=\w)/g, "$1").replace(/\*/g, "");
    const { base, groups } = parenSplit(clean);
    const cands = [base, ...groups.flatMap((g) => [g, parenSplit(g).base])]
      .filter(Boolean)
      .flatMap((c) => [
        c,
        c.replace(new RegExp(`^${PREP}\\s+`), "").replace(new RegExp(`(\\s+${PREP})+$`), ""),
      ]);
    return cands.some(
      (c) => canon.has(norm(c)) || canon.has(norm(c.replace(/^(de|het|een|zich) /, ""))),
    );
  };
  const rows = [];
  for (let i = 0; i < main.length; i++) {
    if (main[i].trim() !== "Vocabulaire") continue;
    const block = [];
    for (let j = i + 1; j < main.length; j++) {
      if (STOP_HEADING.test(main[j].trim())) break;
      block.push(main[j]);
    }
    if (block.filter((l) => l.includes("\t")).length >= 4) rows.push(...parseVocabBlock(block, isCanonText, warnings));
  }

  // ---- struikelwoorden examples: per word heading, keep the FIRST item only
  // Known * surfaces from the lists make heading detection exact.
  const headingKeys = (text) => {
    const out = [];
    for (const part of text.split(/[/,]/)) {
      const t = part.trim().replace(/\*/g, "");
      if (!t) continue;
      const { base, groups } = parenSplit(t);
      out.push(norm(t.replace(/[()]/g, "")), norm(base || t));
      for (const g of groups) out.push(norm(g), norm(parenSplit(g).base || g));
    }
    return [...new Set(out.filter(Boolean).flatMap((k) => [k, k.replace(/^(de|het|een|zich) /, "")]))];
  };
  const knownStruik = new Set(
    rows.filter((r) => r.nlRaw.includes("*")).flatMap((r) => headingKeys(r.nlRaw)),
  );
  const examplesByWord = new Map();
  for (let i = 0; i < main.length; i++) {
    if (!/^Struikelwoord(en)?$/.test(main[i].trim())) continue;
    let heading = null;   // current word (null once its first example is committed)
    let buf = [];
    const commit = () => {
      if (!heading || !buf.length) return;
      const text = buf.join(" ").replace(/(\w)- (\w)/g, "$1$2").replace(/\s+/g, " ").trim();
      for (const h of headingKeys(heading)) {
        if (!examplesByWord.has(h)) examplesByWord.set(h, text);
      }
      heading = null;
      buf = [];
    };
    for (let j = i + 1; j < main.length; j++) {
      const t = main[j].trim();
      if (STOP_HEADING.test(t)) break;
      const isItemStart = /^[\d•]\s?/.test(t);
      const matchesKnown = !isItemStart && headingKeys(t).some((k) => knownStruik.has(k));
      const isHeading =
        matchesKnown ||
        (!isItemStart && t.length < 60 && !/[.?!,:]$/.test(t) && !t.includes("\t") &&
          /^[a-zà-ž(]/i.test(t) && norm(t).split(" ").length <= 6 &&
          // a heading follows either the section start or a finished sentence
          (j === i + 1 || /[.?!]$/.test(main[j - 1]?.trim() ?? "") || heading !== null && buf.length === 0));
      if (matchesKnown) {
        commit(); // a known * word always starts a new entry
        heading = t;
        continue;
      }
      if (isHeading && buf.length === 0) {
        heading = t;
        continue;
      }
      if (heading === null) continue; // skip items 2+ until the next heading
      if (isItemStart && buf.length > 0) {
        commit(); // first item finished; ignore the rest for this word
        continue;
      }
      buf.push(t.replace(/^[\d•]\s*/, ""));
    }
    commit();
  }

  // ---- build words
  const words = [];
  const seen = new Map(); // norm(nl) → word
  const addWord = (w) => {
    const key = norm(w.nl);
    if (seen.has(key)) return seen.get(key);
    // resolve id collisions
    let id = `h${n}-${slug(w.nl)}`;
    if (words.some((x) => x.id === id)) id = `${id}-2`;
    w.id = id;
    words.push(w);
    seen.set(key, w);
    return w;
  };

  for (const row of rows) {
    let nlCell = row.nlRaw.replace(/(\w)- (?=\w)/g, "$1").replace(/\s+/g, " ").trim();
    const struik = /\*/.test(nlCell);
    nlCell = nlCell.replace(/\*/g, "").trim();
    const { base, groups } = parenSplit(nlCell);

    // find the canonical form: prefer an index match among base + groups
    let canonical = null;
    let hintParts = [];
    const stripPreps = (s) => s.replace(/\s+(naar|van|op|met|aan|voor|in|tot|over|uit|bij|om|door)(\s+(naar|van|op|met|aan|voor|in|tot|over|uit|bij|om|door))*$/,"");
    // base matches exactly (or minus article) only — stripping prepositions
    // from the base would canonicalize "een kwestie van" into "de kwestie";
    // parenthesized lemma groups get the full loose matching.
    const candidates = [base, ...groups.flatMap((g) => [g, parenSplit(g).base]).filter(Boolean).flatMap((c) => [c, stripPreps(c)])].filter(Boolean);
    for (const c of candidates) {
      const hit = canon.get(norm(c)) || canon.get(norm(c.replace(/^(de|het|een|zich) /, "")));
      if (hit) {
        canonical = hit;
        break;
      }
    }
    let nl;
    let usageHint = canonical?.usage ?? null;
    if (canonical) {
      nl = canonical.nl;
      // surface form differs from canonical → it becomes the hint
      if (norm(base) && norm(base) !== norm(nl) && norm(base) !== norm(nl.replace(/^(de|het|een|zich) /, ""))) {
        hintParts.push(base);
      }
      for (const g of groups) {
        const gBase = parenSplit(g).base;
        if (norm(g) !== norm(nl) && norm(gBase) !== norm(nl) && /[\/‒]|\b(hebben|zijn|het)\b/i.test(g)) {
          hintParts.push(g.replace(/‒/g, nl.replace(/^(de|het|een) /, "")));
        }
      }
    } else {
      // no index match: last parenthetical that looks like a lemma wins
      const lemmaish = groups.map((g) => parenSplit(g).base).find((g) => /^((de|het|een|zich) )?[a-zà-ž-]+$/i.test(g || ""));
      nl = lemmaish && base && !/^(de|het|een|zich) /.test(base) ? lemmaish : base || nlCell;
      if (norm(base) && norm(base) !== norm(nl)) hintParts.push(base);
      for (const g of groups) if (norm(g) !== norm(nl)) hintParts.push(g);
      if (base && groups.length === 0) nl = base;
    }
    nl = nl.replace(/\s+/g, " ").trim();
    // Both "een kwestie van" and "de kwestie" canonicalize to the same index
    // lemma but are distinct printed entries — keep the surface form when the
    // canonical one is already taken.
    if (seen.has(norm(nl)) && base && norm(base) !== norm(nl)) {
      nl = base;
      hintParts = hintParts.filter((h) => norm(h) !== norm(base));
    }

    const { glosses, note } = parseEnglish(row.enRaw);
    if (!glosses.length) {
      warnings.push(`no gloss for "${nlCell}"`);
      continue;
    }

    const lemma = nl.replace(/^(de|het|een|zich) /, "");
    const artM = nl.match(/^(de|het) (\S+)$/);
    const w = {
      id: "",
      chapter: n,
      nl,
      lemma,
      pos: "other",
      en: glosses,
      primaryEn: glosses[0],
      source: struik ? "struikelwoorden" : "vocabulaire-list",
    };
    if (artM) {
      w.article = artM[1];
      w.pos = "noun";
    } else if (/^zich /.test(nl)) {
      w.reflexive = true;
      w.pos = "verb";
    } else if (!nl.includes(" ") && (glosses[0].startsWith("to ") || separable.has(norm(nl)) || irregular.has(norm(nl)))) {
      w.pos = "verb";
    } else if (nl.includes(" ")) {
      w.pos = "phrase";
    } else if (/^to /.test(glosses[0])) {
      w.pos = "verb";
    }
    if (separable.has(norm(lemma))) {
      w.separable = true;
      if (/…/.test(base) && norm(base) !== norm(nl)) {
        /* surface hint already captured */
      } else if (!hintParts.some((h) => h.includes("…"))) {
        // synthesize the split hint: "aanmoedigen" → "aan … moedigen" is not
        // derivable mechanically, so only keep it when the book printed it.
      }
    }
    const irr = irregular.get(norm(lemma));
    if (irr) w.irregular = irr;
    if (note) w.note = note;
    const hint = [...new Set(hintParts.map((h) => h.replace(/\s+/g, " ").trim()).filter(Boolean))].join("; ");
    if (hint) w.hint = hint;
    if (usageHint && !hint) w.hint = usageHint;
    if (struik) w.struikelwoord = true;
    const exKeys = [norm(nl), norm(lemma), norm(base), ...headingKeys(nl), ...headingKeys(nlCell)];
    const ex = exKeys.map((k) => examplesByWord.get(k)).find(Boolean);
    if (ex) w.examples = [ex];
    if (struik && !w.examples) warnings.push(`struikelwoord without example: ${nl}`);
    addWord(w);
  }

  // ---- idioms + index-only words (Dutch-only → gloss override or review)
  const addDutchOnly = (raw, sourceKind) => {
    // idiom lines can carry parenthesized particles: "in staat zijn (om / tot)"
    const { base, groups } = parenSplit(raw.trim().replace(/[–—]/g, "‒"));
    const nl = (base || raw).replace(/\s+/g, " ").trim();
    const parenHint = groups.length ? groups.join("; ") : null;
    const key = norm(nl);
    if (seen.has(key)) return;
    const over = glossOverrides[`h${n}:${nl}`] || glossOverrides[`h${n}:${key}`] || glossOverrides[key];
    const lemma = nl.replace(/^(de|het|een|zich) /, "");
    const artM = nl.match(/^(de|het) (\S+)$/);
    const w = {
      id: "",
      chapter: n,
      nl,
      lemma,
      pos: artM ? "noun" : nl.includes(" ") ? "phrase" : /en$/.test(nl) ? "verb" : "other",
      en: over ? over.en : ["(needs translation)"],
      primaryEn: over ? over.en[0] : "(needs translation)",
      source: "generated",
      needsReview: over?.reviewed ? undefined : true,
    };
    if (artM) w.article = artM[1];
    if (/^zich /.test(nl)) {
      w.reflexive = true;
      w.pos = "verb";
    }
    if (over?.pos) w.pos = over.pos;
    if (over?.note) w.note = over.note;
    if (parenHint) w.hint = parenHint;
    const irr = irregular.get(norm(lemma));
    if (irr) w.irregular = irr;
    if (separable.has(norm(lemma))) w.separable = true;
    if (w.needsReview === undefined) delete w.needsReview;
    const ex = examplesByWord.get(key);
    if (ex) w.examples = [ex];
    addWord(w);
    if (!over) warnings.push(`${sourceKind} without translation (needsReview): ${nl}`);
  };

  for (const idiom of idioms) addDutchOnly(idiom, "idiom");
  for (const e of indexLemmas) addDutchOnly(e.nl, "index-only word");
  // Preposities lines that aren't just a known word + preposition are real
  // fixed expressions ("voor het eerst") — include them.
  const lemmaTokens = new Set(words.flatMap((w) => norm(w.lemma).split(/\s+/).filter((t) => t.length >= 4)));
  for (const line of sections.Preposities) {
    const clean = line.trim().replace(/[()]/g, "");
    if (!clean) continue;
    const tokens = norm(clean).split(/[\s/]+/).filter((t) => t.length >= 4);
    if (!tokens.some((t) => lemmaTokens.has(t))) addDutchOnly(line.trim(), "prepositie expression");
  }

  return { words, theme };
}

// --------------------------------------------------------------------- main

const themes = {};
const chapterBlocks = new Map();

const text = await extractText();
const allLines = text.split("\n");

// chapter openers: "Hoofdstuk N" alone on a line, followed by the theme
const openers = [];
for (let i = 0; i < allLines.length; i++) {
  const m = allLines[i].match(/^Hoofdstuk (\d+)$/);
  if (m && allLines[i + 1] && !/^Opdracht/.test(allLines[i + 1])) {
    const nn = Number(m[1]);
    if (!openers.some((o) => o.n === nn)) openers.push({ n: nn, line: i, theme: allLines[i + 1].trim() });
  }
}
openers.sort((a, b) => a.line - b.line);
for (let i = 0; i < openers.length; i++) {
  const end = i + 1 < openers.length ? openers[i + 1].line : allLines.length;
  chapterBlocks.set(openers[i].n, allLines.slice(openers[i].line + 2, end));
  themes[openers[i].n] = openers[i].theme;
}

const glossOverridesPath = join(here, "generated-glosses.json");
const glossOverrides = existsSync(glossOverridesPath) ? JSON.parse(readFileSync(glossOverridesPath, "utf8")) : {};

mkdirSync(outDir, { recursive: true });
mkdirSync(reviewDir, { recursive: true });

const manifest = [];
let totalReview = 0;
for (const [n, chLines] of [...chapterBlocks.entries()].sort((a, b) => a[0] - b[0])) {
  const warnings = [];
  const { words } = parseChapter(chLines, n, themes[n], glossOverrides, warnings);
  const file = join(outDir, `hoofdstuk-${String(n).padStart(2, "0")}.json`);
  writeFileSync(file, JSON.stringify(words, null, 2) + "\n");
  manifest.push({ number: n, title: `Hoofdstuk ${n}`, theme: themes[n], wordCount: words.length });

  const review = words.filter((w) => w.needsReview);
  totalReview += review.length;
  const md = [
    `# Hoofdstuk ${n} — ${themes[n]}: review`,
    "",
    `${words.length} words, ${review.length} need review.`,
    "",
    "## needsReview entries",
    ...review.map((w) => `- **${w.nl}** → ${w.en.join("; ")}`),
    "",
    "## parser warnings",
    ...warnings.map((w) => `- ${w}`),
    "",
  ].join("\n");
  writeFileSync(join(reviewDir, `hoofdstuk-${String(n).padStart(2, "0")}_review.md`), md);
  console.log(`h${String(n).padStart(2, "0")} ${themes[n]}: ${words.length} words, ${review.length} need review, ${warnings.length} warnings`);
}

writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest written; ${totalReview} entries need review overall`);
