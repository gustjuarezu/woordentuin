import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { chapterLabel, chapters, loadAllWords } from "../data";
import type { Word } from "../data/types";
import { countDue } from "../engine/session";
import { CROWN_LEVELS, crownLevel, growthStage, STAGE_MAX } from "../engine/srs";
import { Garden } from "../components/Garden";
import { useApp } from "../store/useApp";

export function Home() {
  const states = useApp((s) => s.cardStates);
  const [allWords, setAllWords] = useState<Word[]>([]);

  useEffect(() => {
    void loadAllWords().then(setAllWords);
  }, []);

  const due = countDue(allWords, states, Date.now());

  return (
    <section>
      <p className="eyebrow">Dutch vocabulary trainer</p>
      <h1>
        Grow your Dutch,
        <br />
        one word at a time.
      </h1>
      <p className="sub">
        Bite-sized lessons per hoofdstuk of <i>Nederlands in actie</i> — with spaced repetition, audio, and a
        garden that blooms as words stick.
      </p>

      <div className="row" style={{ marginBottom: 18 }}>
        <Link
          to="/review"
          className={`btn ${due > 0 ? "btn-honey" : "btn-ghost"}`}
          aria-disabled={due === 0}
          style={due === 0 ? { opacity: 0.55, pointerEvents: "none" } : undefined}
        >
          {due > 0 ? `Oefenen · ${due} due` : "Oefenen · nothing due"}
        </Link>
      </div>

      <div className="row" style={{ marginBottom: 18 }}>
        <Link to="/level-test" className="btn btn-primary">
          Niveautoets · Level 4 — focus Geld (H6–10)
        </Link>
      </div>

      {chapters.map((ch) => {
        const words = allWords.filter((w) => w.chapter === ch.number);
        const stages = words.map((w) => growthStage(states.get(w.id)));
        const pct = words.length
          ? Math.round((stages.reduce((a, b) => a + b, 0) / (words.length * STAGE_MAX)) * 100)
          : 0;
        const bloomed = stages.filter((s) => s >= STAGE_MAX).length;
        const crown = crownLevel(stages);
        return (
          <div className="chapcard" key={ch.number}>
            <div className="ch-head">
              <div>
                <h2>{chapterLabel(ch)}</h2>
                <p className="ch-meta">
                  {ch.wordCount} words · {bloomed} bloomed
                  {crown > 0 && (
                    <>
                      {" "}
                      · <span className="tag">{CROWN_LEVELS[crown - 1]}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="pct">{pct}%</div>
            </div>
            {words.length > 0 && <Garden words={words} states={states} />}
            <div className="row">
              <Link className="btn btn-primary" to={`/chapter/${ch.number}`}>
                {pct > 0 ? "Continue" : "Start"}
              </Link>
            </div>
          </div>
        );
      })}

      <p className="footnote">Install: Share → Add to Home Screen. Your progress lives on this device.</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <Link to="/stats" className="reset" style={{ display: "inline" }}>
          Stats
        </Link>
        <Link to="/settings" className="reset" style={{ display: "inline" }}>
          Settings
        </Link>
      </div>
    </section>
  );
}
