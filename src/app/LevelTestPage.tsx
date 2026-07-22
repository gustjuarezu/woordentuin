import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loadAllWords } from "../data";
import type { Word } from "../data/types";
import { buildExamTasks, buildLevel4ExamPool, DEFAULT_TEST_SIZE } from "../engine/exam";
import type { SessionTask } from "../engine/session";
import { LessonRunner, type LessonSummary } from "../components/LessonRunner";
import { SummaryScreen } from "../components/SummaryScreen";
import { speakerAvailable } from "../components/Speaker";
import { useApp } from "../store/useApp";

/**
 * TaalBoost Level 4 mock exam (/level-test): a weighted round over Hoofdstuk
 * 6–10 vocabulary, ~65% from the Geld chapter + the Les 11 handout words.
 * Grades onto isolated `id#test` cards, so it never touches the garden, the
 * review queue, or the daily new-word budget. Freely retakeable.
 */
export function LevelTestPage() {
  const navigate = useNavigate();
  const [allWords, setAllWords] = useState<Word[] | null>(null);
  const [tasks, setTasks] = useState<SessionTask[] | null>(null);
  const [summary, setSummary] = useState<LessonSummary | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    void loadAllWords().then(setAllWords);
  }, []);

  const pool = useMemo(() => (allWords ? buildLevel4ExamPool(allWords) : []), [allWords]);
  const poolWords = useMemo(() => pool.map((e) => e.word), [pool]);

  useEffect(() => {
    if (pool.length > 0) {
      setTasks(
        buildExamTasks(
          pool,
          useApp.getState().cardStates,
          { ttsAvailable: speakerAvailable() },
          DEFAULT_TEST_SIZE,
        ),
      );
      setSummary(null);
    }
    // Rebuild per round, not on every grade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, round]);

  if (!allWords || !tasks) return <p className="sub">Loading…</p>;

  if (summary) {
    return (
      <SummaryScreen
        summary={summary}
        onHome={() => navigate("/")}
        onAgain={() => setRound((r) => r + 1)}
      />
    );
  }

  if (tasks.length === 0) {
    return (
      <section>
        <Link to="/" className="backlink">
          ← Home
        </Link>
        <div className="notice">No exam words available.</div>
      </section>
    );
  }

  return (
    <LessonRunner
      key={round}
      mode="test"
      tasks={tasks}
      pool={poolWords}
      newWords={[]}
      onQuit={() => navigate("/")}
      onFinish={setSummary}
    />
  );
}
