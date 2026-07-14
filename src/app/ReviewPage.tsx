import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loadAllWords } from "../data";
import type { Word } from "../data/types";
import { buildReviewWords, buildTasks, type SessionTask } from "../engine/session";
import { LessonRunner, type LessonSummary } from "../components/LessonRunner";
import { speakerAvailable } from "../components/Speaker";
import { SummaryScreen } from "../components/SummaryScreen";
import { useApp } from "../store/useApp";

/** Global "Oefenen" review: all due cards across every chapter (the SRS heartbeat). */
export function ReviewPage() {
  const navigate = useNavigate();
  const [words, setWords] = useState<Word[] | null>(null);
  const [tasks, setTasks] = useState<SessionTask[] | null>(null);
  const [summary, setSummary] = useState<LessonSummary | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    void loadAllWords().then(setWords);
  }, []);

  const build = useCallback((all: Word[]) => {
    const states = useApp.getState().cardStates;
    const due = buildReviewWords(all, states, Date.now(), 20);
    return buildTasks(due, states, { ttsAvailable: speakerAvailable() });
  }, []);

  useEffect(() => {
    if (words) {
      setTasks(build(words));
      setSummary(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, round]);

  if (!words || !tasks) return <p className="sub">Loading…</p>;

  if (summary) {
    return <SummaryScreen summary={summary} onHome={() => navigate("/")} onAgain={() => setRound((r) => r + 1)} />;
  }

  if (tasks.length === 0) {
    return (
      <section>
        <Link to="/" className="backlink">
          ← Home
        </Link>
        <div className="notice">Nothing is due for review — the garden is watered. 🌿 Come back later, or start a lesson.</div>
      </section>
    );
  }

  return (
    <LessonRunner
      key={round}
      tasks={tasks}
      pool={words}
      newWords={[]}
      onQuit={() => navigate("/")}
      onFinish={setSummary}
    />
  );
}
