import type { LessonSummary } from "./LessonRunner";
import { useApp } from "../store/useApp";
import { SpeakerButton } from "./Speaker";

export function SummaryScreen({
  summary,
  onHome,
  onAgain,
}: {
  summary: LessonSummary;
  onHome: () => void;
  onAgain: () => void;
}) {
  const streak = useApp((s) => s.profile.streak);
  const acc = summary.total ? Math.round((summary.correct / summary.total) * 100) : 0;
  const emoji = summary.ranOutOfHearts ? "🥀" : summary.bloomed.length ? "🌸" : acc >= 80 ? "🌿" : "🌱";
  const title = summary.ranOutOfHearts
    ? "Out of hearts"
    : summary.bloomed.length
      ? "Words bloomed!"
      : acc >= 80
        ? "Strong round!"
        : "Keep growing";
  const line = summary.bloomed.length
    ? `${summary.bloomed.length} word${summary.bloomed.length > 1 ? "s" : ""} in full bloom.`
    : `${summary.correct} of ${summary.total} correct · +${summary.xp} XP. Repetition is how it sticks.`;

  return (
    <section className="summary">
      <div className="big">{emoji}</div>
      <h2>{title}</h2>
      <p>{line}</p>
      <div className="scoregrid">
        <div className="scorebox">
          <div className="n">{acc}%</div>
          <div className="l">Correct</div>
        </div>
        <div className="scorebox">
          <div className="n grew">{summary.grew.length}</div>
          <div className="l">Grew 🌿</div>
        </div>
        <div className="scorebox">
          <div className="n">{streak}</div>
          <div className="l">Streak</div>
        </div>
      </div>
      <ul className="review-list">
        {summary.words.map((w) => (
          <li key={w.id}>
            <span className="nl">
              <SpeakerButton text={w.nl} size="sm" />
              <span>{w.nl}</span>
            </span>
            <span className="en">{w.en.join("; ")}</span>
          </li>
        ))}
      </ul>
      <div className="row">
        <button className="btn btn-ghost" onClick={onHome}>
          Home
        </button>
        <button className="btn btn-primary" onClick={onAgain}>
          Another round
        </button>
      </div>
    </section>
  );
}
