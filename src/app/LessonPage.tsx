import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { chapterLabel, chapterMeta, loadChapterWords } from "../data";
import type { Word } from "../data/types";
import { growthStage, isDue } from "../engine/srs";
import { buildLessonWords, buildTasks, chunkLessons, shuffle, type SessionTask } from "../engine/session";
import { LessonRunner, type LessonSummary } from "../components/LessonRunner";
import { speakerAvailable } from "../components/Speaker";
import { SummaryScreen } from "../components/SummaryScreen";
import { useApp } from "../store/useApp";

interface Session {
  tasks: SessionTask[];
  newWords: Word[];
  pool: Word[];
}

/** Runs both a numbered lesson (/chapter/:n/lesson/:i) and the chapter
 * practice mix (/chapter/:n/practice). */
export function LessonPage({ practice = false }: { practice?: boolean }) {
  const { n, i } = useParams();
  const num = Number(n);
  const lessonIndex = practice ? -1 : Number(i);
  const navigate = useNavigate();
  const app = useApp();
  const [words, setWords] = useState<Word[] | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [summary, setSummary] = useState<LessonSummary | null>(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    void loadChapterWords(num).then(setWords);
  }, [num]);

  const build = useCallback(
    (chapterWords: Word[]): Session => {
      const states = useApp.getState().cardStates;
      const now = Date.now();
      const opts = { ttsAvailable: speakerAvailable() };
      if (practice) {
        const due = chapterWords.filter((w) => {
          const s = states.get(w.id);
          return s && isDue(s, now);
        });
        const introduced = chapterWords.filter(
          (w) => states.get(w.id)?.introduced && !due.some((d) => d.id === w.id),
        );
        // Weakest first fills the round when little is due.
        introduced.sort((a, b) => growthStage(states.get(a.id)) - growthStage(states.get(b.id)));
        const pick = [...shuffle(due).slice(0, 10), ...introduced.slice(0, Math.max(0, 10 - due.length))];
        return { tasks: buildTasks(pick, states, opts), newWords: [], pool: chapterWords };
      }
      const lessons = chunkLessons(chapterWords, useApp.getState().settings.lessonSize);
      const lesson = lessons[lessonIndex] ?? [];
      const { newWords, reviewWords } = buildLessonWords(
        lesson,
        chapterWords,
        states,
        now,
        app.newRemainingToday(num, now),
      );
      return {
        tasks: buildTasks([...newWords, ...reviewWords], states, opts),
        newWords,
        pool: chapterWords,
      };
    },
    [practice, lessonIndex, num, app],
  );

  useEffect(() => {
    if (words) {
      setSession(build(words));
      setSummary(null);
    }
    // Rebuild when the data, the round, or the route target changes (React
    // reuses this component instance across lesson/practice routes) — but not
    // on every grade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, round, practice, lessonIndex, num]);

  const meta = chapterMeta(num);
  if (!meta) return <p>Unknown chapter.</p>;
  if (!words || !session) return <p className="sub">Loading…</p>;

  if (summary) {
    return (
      <SummaryScreen
        summary={summary}
        onHome={() => navigate(`/chapter/${num}`)}
        onAgain={() => setRound((r) => r + 1)}
      />
    );
  }

  if (session.tasks.length === 0) {
    return (
      <section>
        <Link to={`/chapter/${num}`} className="backlink">
          ← {chapterLabel(meta)}
        </Link>
        <div className="notice">
          Nothing to practise right now — today’s new-word limit is reached and no reviews are due in this
          chapter. Try the global <Link to="/review" style={{ textDecoration: "underline" }}>Oefenen</Link> queue,
          or raise the daily limit in Settings.
        </div>
      </section>
    );
  }

  return (
    <LessonRunner
      key={round}
      tasks={session.tasks}
      pool={session.pool}
      newWords={session.newWords}
      chapterForThrottle={num}
      onQuit={() => navigate(`/chapter/${num}`)}
      onFinish={setSummary}
    />
  );
}
