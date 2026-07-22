import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { chapterLabel, chapters, loadAllWords } from "../data";
import type { Word } from "../data/types";
import { countDue } from "../engine/session";
import { growthStage, STAGE_MAX } from "../engine/srs";
import { useApp } from "../store/useApp";

export function StatsPage() {
  const states = useApp((s) => s.cardStates);
  const profile = useApp((s) => s.profile);
  const [allWords, setAllWords] = useState<Word[]>([]);

  useEffect(() => {
    void loadAllWords().then(setAllWords);
  }, []);

  const introduced = allWords.filter((w) => states.get(w.id)?.introduced).length;
  const bloomed = allWords.filter((w) => growthStage(states.get(w.id)) >= STAGE_MAX).length;
  const due = countDue(allWords, states, Date.now());

  return (
    <section>
      <Link to="/" className="backlink">
        ← Home
      </Link>
      <h1 style={{ fontSize: "1.9rem" }}>Stats</h1>
      <div className="statgrid">
        <div className="scorebox">
          <div className="n">{profile.xp}</div>
          <div className="l">Total XP</div>
        </div>
        <div className="scorebox">
          <div className="n">{profile.streak}</div>
          <div className="l">Day streak</div>
        </div>
        <div className="scorebox">
          <div className="n">{introduced}</div>
          <div className="l">Words learning</div>
        </div>
        <div className="scorebox">
          <div className="n grew">{bloomed}</div>
          <div className="l">In bloom 🌸</div>
        </div>
      </div>
      <div className="chapcard">
        {chapters.map((ch) => {
          const words = allWords.filter((w) => w.chapter === ch.number);
          const stages = words.map((w) => growthStage(states.get(w.id)));
          const pct = words.length
            ? Math.round((stages.reduce((a, b) => a + b, 0) / (words.length * STAGE_MAX)) * 100)
            : 0;
          return (
            <div className="lesson-item" key={ch.number}>
              <div>
                <strong>{chapterLabel(ch)}</strong>
                <div className="words-preview">
                  {stages.filter((s) => s > 0).length}/{words.length} planted ·{" "}
                  {stages.filter((s) => s >= STAGE_MAX).length} bloomed
                </div>
              </div>
              <div className="pct" style={{ fontSize: "1.2rem" }}>
                {pct}%
              </div>
            </div>
          );
        })}
      </div>
      <p className="footnote">{due} card{due === 1 ? "" : "s"} due for review right now.</p>
    </section>
  );
}
