import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { chapterMeta, loadChapterWords } from "../data";
import type { Word } from "../data/types";
import { eligibleParticipleVerbs } from "../engine/participle";
import { buildParticipleTasks, type SessionTask } from "../engine/session";
import { LessonRunner, type LessonSummary } from "../components/LessonRunner";
import { SummaryScreen } from "../components/SummaryScreen";
import { useApp } from "../store/useApp";

/** The per-chapter voltooid-deelwoord drill (/chapter/:n/participles).
 * Grades onto separate `id#pp` cards; no new-word throttle involved. */
export function ParticiplePage() {
  const { n } = useParams();
  const num = Number(n);
  const navigate = useNavigate();
  const [verbs, setVerbs] = useState<Word[] | null>(null);
  const [tasks, setTasks] = useState<SessionTask[] | null>(null);
  const [summary, setSummary] = useState<LessonSummary | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    void loadChapterWords(num).then((words) => setVerbs(eligibleParticipleVerbs(words)));
  }, [num]);

  useEffect(() => {
    if (verbs) {
      setTasks(buildParticipleTasks(verbs, useApp.getState().cardStates, Date.now()));
      setSummary(null);
    }
    // Rebuild per round, not on every grade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verbs, round, num]);

  const meta = chapterMeta(num);
  if (!meta) return <p>Unknown chapter.</p>;
  if (!verbs || !tasks) return <p className="sub">Loading…</p>;

  if (summary) {
    return (
      <SummaryScreen
        summary={summary}
        onHome={() => navigate(`/chapter/${num}`)}
        onAgain={() => setRound((r) => r + 1)}
      />
    );
  }

  if (tasks.length === 0) {
    return (
      <section>
        <Link to={`/chapter/${num}`} className="backlink">
          ← {meta.title}
        </Link>
        <div className="notice">This chapter has no verbs to drill.</div>
      </section>
    );
  }

  return (
    <LessonRunner
      key={round}
      mode="participle"
      tasks={tasks}
      pool={verbs}
      newWords={[]}
      onQuit={() => navigate(`/chapter/${num}`)}
      onFinish={setSummary}
    />
  );
}
