import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { chapterMeta, loadChapterWords } from "../data";
import type { Word } from "../data/types";
import { chunkLessons, countDue, countDuePP } from "../engine/session";
import { eligibleParticipleVerbs, ppKey } from "../engine/participle";
import { CROWN_LEVELS, crownLevel, growthStage, STAGE_MAX } from "../engine/srs";
import { Garden } from "../components/Garden";
import { useApp } from "../store/useApp";

export function ChapterPage() {
  const { n } = useParams();
  const num = Number(n);
  const meta = chapterMeta(num);
  const states = useApp((s) => s.cardStates);
  const lessonSize = useApp((s) => s.settings.lessonSize);
  const [words, setWords] = useState<Word[]>([]);

  useEffect(() => {
    void loadChapterWords(num).then(setWords);
  }, [num]);

  if (!meta) return <p>Unknown chapter.</p>;

  const lessons = chunkLessons(words, lessonSize);
  const stages = words.map((w) => growthStage(states.get(w.id)));
  const crown = crownLevel(stages);
  const due = countDue(words, states, Date.now());
  const introducedCount = words.filter((w) => states.get(w.id)?.introduced).length;
  const verbs = eligibleParticipleVerbs(words);
  const ppDue = countDuePP(verbs, states, Date.now());
  const ppStarted = verbs.some((w) => states.get(ppKey(w.id)));

  return (
    <section>
      <Link to="/" className="backlink">
        ← Home
      </Link>
      <div className="ch-head">
        <div>
          <h1 style={{ fontSize: "1.9rem" }}>{meta.title}</h1>
          <p className="ch-meta">
            {meta.theme} · {words.length} words
            {crown > 0 && (
              <>
                {" "}
                · <span className="tag">{CROWN_LEVELS[crown - 1]}</span>
              </>
            )}
          </p>
        </div>
        <div className="pct">
          {words.length
            ? Math.round((stages.reduce((a, b) => a + b, 0) / (words.length * STAGE_MAX)) * 100)
            : 0}
          %
        </div>
      </div>

      {words.length > 0 && <Garden words={words} states={states} />}

      <div className="row" style={{ marginBottom: 16 }}>
        <Link
          to={`/chapter/${num}/practice`}
          className="btn btn-honey"
          style={introducedCount === 0 ? { opacity: 0.55, pointerEvents: "none" } : undefined}
        >
          Practice mix{due > 0 ? ` · ${due} due` : ""}
        </Link>
      </div>

      {verbs.length > 0 && (
        <div className="chapcard" style={{ marginBottom: 16 }}>
          <div className="lesson-item">
            <div>
              <strong>Voltooid deelwoord</strong>{" "}
              {ppDue > 0 ? (
                <span className="tag">{ppDue} due</span>
              ) : (
                <span className="ch-meta">{verbs.length} werkwoorden</span>
              )}
              <div className="words-preview">
                {verbs
                  .slice(0, 4)
                  .map((w) => w.lemma)
                  .join(" · ")}
                {verbs.length > 4 ? " …" : ""}
              </div>
            </div>
            <Link className="btn btn-primary" to={`/chapter/${num}/participles`}>
              {ppStarted ? "Repeat" : "Start"}
            </Link>
          </div>
        </div>
      )}

      <div className="chapcard">
        {lessons.map((lesson, i) => {
          const newCount = lesson.filter((w) => !states.get(w.id)?.introduced).length;
          const done = newCount === 0;
          return (
            <div className="lesson-item" key={i}>
              <div>
                <strong>Les {i + 1}</strong>{" "}
                {done ? <span className="tag">Introduced</span> : <span className="ch-meta">{newCount} new</span>}
                <div className="words-preview">
                  {lesson
                    .slice(0, 4)
                    .map((w) => w.nl)
                    .join(" · ")}
                  {lesson.length > 4 ? " …" : ""}
                </div>
              </div>
              <Link className="btn btn-primary" to={`/chapter/${num}/lesson/${i}`}>
                {done ? "Repeat" : "Start"}
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
