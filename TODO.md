# Woordentuin — TODO / decisions log

## Decisions made (brief allowed discretion)

- **Plain CSS design tokens instead of Tailwind** (`src/styles/tokens.css`) — the brief
  explicitly allowed it; this reproduces the prototype's visual identity 1:1 with one
  less toolchain.
- **SM-2-lite over FSRS** — documented in `src/engine/srs.ts`. The grading signal is
  coarse and the deck small; the `gradeCard` interface allows swapping FSRS in later.
- **HashRouter** — works on any static host (GitHub Pages, Netlify) and inside
  sandboxed iframes without rewrite rules.
- **Listening exercise = hear Dutch → choose the Dutch text** (Duolingo "what do you
  hear"). Type-what-you-hear is a possible variant later.
- **Pairs grading**: clean match → good, 1 mismatch → hard, ≥2 → again.
- **"Easy" grade** = correct, no hint, under 5s.
- **Bloom thresholds**: interval ≥1d sprout, ≥3d leaf, ≥7d bud, ≥21d flower (stage 5
  = "bloomed" in the garden).
- **Separable-verb split hints** (e.g. "aan … moedigen") are kept only when the book
  prints them — they aren't derivable mechanically.
- New-word introductions are counted against the daily throttle **when a lesson
  finishes** (quitting mid-lesson doesn't consume the budget even though graded words
  keep their SRS state).
- **Voltooid deelwoord drill (2026-07-16)**: per-chapter section → `/chapter/:n/participles`,
  type-the-participle exercise; regular forms derived at runtime (`src/engine/participle.ts`,
  exceptions in `src/data/participle-overrides.json` — keyed by lemma so they survive
  re-ingestion), irregular forms from the book's list. "Regular vs irregular" = actual form
  vs derived weak form (so weak-participle book verbs like *afvragen → afgevraagd* show
  regelmatig). SRS on separate `wordId#pp` cards (no Dexie migration; garden/review/new-word
  budget untouched). The corpus audit lives in `src/engine/participle.corpus.test.ts` +
  `participle.expected.json` (all 266 forms hand-audited) — it diffs loudly after any book
  re-ingest; fix overrides, never chapter JSONs.

- **Level test / Niveautoets (2026-07-22)**: TaalBoost Level 4 mock exam over H6–10 →
  `/level-test` (`src/app/LevelTestPage.tsx`), weighted so ~65% of questions come from
  the Geld chapter (H10 — the *Tikkie* text) + the Les 11 handout words, ~35% from
  H6–9 filler. Reuses the existing exercise types via `LessonRunner` (`mode="test"`) and
  `SummaryScreen` (its accuracy % is the score). The book data has **no "orange" flag**,
  so the *Les 11 handout* is used as the teacher-curated importance signal. Curated set
  lives in `src/data/exam/level4.json` (re-ingest-safe, keyed by lemma like the participle
  overrides): `handoutLemmas` promotes 10 H6–9 verbs to the handout bucket, and 32
  `extraWords` supply handout words missing from the book (verslaafd/gewend/geschikt,
  uitgeven/verdienen/pincode, plotseling/ineens, voorstelling/verspilling, bemoeien +
  the *versterkte adjectieven*), ids namespaced `l4-*`. Pool = 443 words (78 geld / 42
  handout / 323 orange). Progress is **isolated on `id#test` SRS cards** (like `#pp`) —
  never touches the garden, review queue, stats, or the daily new-word budget; freely
  retakeable. Logic + weighting in `src/engine/exam.ts`, audited in
  `src/engine/exam.test.ts`. H11, grammar drills (passive/separable/ER+prep/irrealis),
  and a type-the-English exercise are **out of scope** (future).

## Book ingestion status

- All **11 hoofdstukken** ingested from `reference/Nederlands_in_actie.pdf`
  (gitignored — copyrighted) via `node tools/ingest/ingest-book.mjs`.
- ~270 Dutch-only entries (Idioom + index-only words) have human-supplied glosses in
  `tools/ingest/generated-glosses.json`.
- **4 entries still flagged `needsReview`** (uncertain glosses, marked
  `reviewed:false`): h3 *twintigen*, h5 *ergens tegenaan zitten*, h6 *het loopt je
  over de schoenen*, h10 *iets niet vinden kunnen*. See
  `tools/ingest/review/hoofdstuk-NN_review.md`. To clear one: fix its entry in
  `generated-glosses.json`, set `reviewed: true`, re-run the ingest script.

## Not built yet (fast-follows from the brief)

- [ ] Type-the-English exercise (§4.3 #6)
- [ ] Word-bank sentence build / cloze from struikelwoorden examples (§4.3 #7)
- [ ] Speaking exercise via SpeechRecognition (stretch, §4.3 #8)
- [ ] Dark mode
- [ ] Playwright smoke tests (Vitest covers the engine; UI was smoke-tested manually)
- [ ] Due `#pp` participle cards in the global `/review` queue (needs a task-level
      key concept in `buildReviewWords`)
- [ ] Participle on-ramp variant (choose t/d ending) and, later, requiring the
      auxiliary (`is`/`heeft`) as part of the answer

## Later (documented, don't build — brief §9)

- Backend for shared progress / classmate leaderboard (needs accounts)
- Cloud neural TTS behind the `src/audio/tts.ts` interface
- Grammar drills (prepositions / verb-conjugation tables)
- Sentence-level exercises from the reading texts

## Deploy

`npm run build` → static `dist/`, drop on Netlify / Vercel / GitHub Pages. See README.
