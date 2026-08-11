# 🌱 Woordentuin

A Duolingo-style Dutch vocabulary trainer, chapter by hoofdstuk, for two course books:
**Level 4 — Nederlands in actie** (4th edition) and **Level 5 — Nederlands op niveau**
(2nd edition). The Home screen picks the level (remembered per device; switchable any
time). Mobile-first installable PWA: spaced repetition
(SM-2-lite), five exercise types, Dutch-only text-to-speech, and a garden that blooms
as words stick. Local-first — each learner's progress lives in their own browser
(IndexedDB); the URL is shareable with classmates.

## Develop

```bash
npm install
npm run dev        # dev server
npm test           # Vitest: engine + data validation + golden fixtures
npm run build      # static bundle in dist/ (PWA: service worker + manifest)
npm run preview    # serve the built bundle
```

## Deploy (static hosting)

`npm run build`, then drop `dist/` on Netlify, Vercel, or GitHub Pages — no backend,
no rewrite rules needed (hash routing, relative base). Open the URL on an iPhone in
Safari → Share → **Add to Home Screen** for the full-screen app. This replaces the old
Google Apps Script hosting hack (the prototype's Code.gs).

Dutch audio requires a Dutch system voice; the app never falls back to an English
voice and explains how to install one (iPhone: Settings → Accessibility → Spoken
Content → Voices → Nederlands, pick "Enhanced").

## Structure

```
src/engine/    srs.ts (SM-2-lite) · checkAnswer.ts · session.ts · mask.ts  — pure, tested
src/data/      types.ts · levels/{4,5}/hoofdstuk-NN.json + manifest.json (generated)
src/store/     Dexie (IndexedDB) behind storage.ts · zustand app store
src/app/       routes: Home / Chapter / Lesson / Review / Stats / Settings
src/components exercises, garden, feedback sheet, summary
src/audio/     tts.ts — strict Dutch voice selection
tools/ingest/  book PDF → chapter JSON pipeline (see below)
reference/     woordentuin.html — the original prototype (design + seed data)
```

## Ingestion: book → chapter JSON

```bash
node tools/ingest/ingest-book.mjs     # level 4 — reads reference/Nederlands_in_actie.pdf (not in git)
node tools/ingest/ingest-niveau.mjs   # level 5 — normalizes tools/ingest/niveau/hoofdstuk-NN.json
```

Parses each chapter's two-column Vocabulaire list (authoritative English),
Struikelwoorden example sentences, and the end-of-chapter index (canonical lemmas,
Idioom, Preposities, irregular + separable verbs), reconciles them, and emits
`src/data/levels/4/hoofdstuk-NN.json` + `manifest.json` + a per-chapter
`tools/ingest/review/hoofdstuk-NN_review.md` listing anything that needs a human
glance. Dutch-only entries get glosses from `tools/ingest/generated-glosses.json`;
entries without a reviewed gloss are flagged `needsReview` in the data.

The extraction is cached in `tools/ingest/.cache/`; delete it to re-extract.
Golden tests assert H7/H8 reproduce the hand-digitized prototype data.

**Level 5** is different: *Nederlands op niveau* is a scanned PDF (no text layer) and
prints **no English translations** at all. The per-chapter source files in
`tools/ingest/niveau/` were transcribed from the end-of-chapter "Vocabulairelijst"
and "Onregelmatige werkwoorden" page images (OCR-cross-checked), with example
sentences lifted from the in-chapter Vocabulaire sections and English glosses
authored during ingestion (hence `source: "generated"` on every level-5 word — audit
trail in `tools/ingest/review/niveau-hoofdstuk-NN_review.md`). Word ids are
`n<chapter>-<slug>`, disjoint from level 4's `h<chapter>-` ids, so SRS state never
collides. After re-ingesting, refresh the participle corpus with
`UPDATE_PP_EXPECTED=1 npx vitest run participle.update` and audit the diff.

**Copyright**: the app stores vocabulary lists and short example sentences only, for
personal study. The book PDF itself is gitignored — keep it out of the repo.
