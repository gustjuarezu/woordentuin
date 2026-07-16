import { useEffect, useMemo, useRef, useState } from "react";
import type { Word } from "../data/types";
import { growthStage, type Grade } from "../engine/srs";
import {
  outcomeToGrade,
  pickDistractors,
  XP_LESSON_BONUS,
  XP_PER_CORRECT,
  type SessionTask,
} from "../engine/session";
import { participleFor, ppKey } from "../engine/participle";
import { stopSpeaking } from "../audio/tts";
import { useApp } from "../store/useApp";
import { FeedbackSheet, type FeedbackData } from "./FeedbackSheet";
import { Listening } from "./exercises/Listening";
import { MultipleChoice } from "./exercises/MultipleChoice";
import { Pairs, type PairsResult } from "./exercises/Pairs";
import { TypeDutch } from "./exercises/TypeDutch";
import { TypeParticiple } from "./exercises/TypeParticiple";
import type { AnswerOutcome } from "./exercises/types";

export interface LessonSummary {
  total: number;
  correct: number;
  grew: Word[];
  bloomed: Word[];
  xp: number;
  words: Word[];
  ranOutOfHearts: boolean;
}

const MAX_REQUEUES_PER_WORD = 2;
const HEARTS_START = 3;

/**
 * Drives a queue of session tasks: renders one exercise at a time, grades
 * answers into the SRS store, requeues "again" cards within the session,
 * and reports a summary when the queue is exhausted.
 */
export function LessonRunner({
  tasks: initialTasks,
  pool,
  newWords,
  chapterForThrottle,
  mode = "vocab",
  onQuit,
  onFinish,
}: {
  tasks: SessionTask[];
  pool: Word[];
  newWords: Word[];
  chapterForThrottle?: number;
  mode?: "vocab" | "participle";
  onQuit: () => void;
  onFinish: (s: LessonSummary) => void;
}) {
  const app = useApp();
  const heartsEnabled = app.settings.hearts;
  const [tasks, setTasks] = useState(initialTasks);
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  // Participle skill lives on its own SRS cards (`id#pp`) so it never touches
  // the vocab card of the same word.
  const keyFor = (w: Word) => (mode === "participle" ? ppKey(w.id) : w.id);
  const [hearts, setHearts] = useState(HEARTS_START);
  const taskStart = useRef(Date.now());
  const requeues = useRef(new Map<string, number>());
  const stats = useRef({
    firstTry: new Map<string, boolean>(),
    grew: new Map<string, Word>(),
    bloomed: new Map<string, Word>(),
    xp: 0,
    seen: new Map<string, Word>(),
  });
  const finished = useRef(false);

  const task = tasks[idx];

  const distractors = useMemo(
    () => (task?.kind === "card" ? pickDistractors(task.word, pool, 3) : []),
    [task, pool],
  );

  useEffect(() => {
    taskStart.current = Date.now();
  }, [idx]);

  const applyGrade = (word: Word, grade: Grade, correct: boolean) => {
    const s = stats.current;
    const prevStage = growthStage(app.cardStates.get(keyFor(word)));
    const next = app.grade(keyFor(word), grade);
    const newStage = growthStage(next);
    s.seen.set(word.id, word);
    if (!s.firstTry.has(word.id)) s.firstTry.set(word.id, correct);
    if (newStage > prevStage) s.grew.set(word.id, word);
    if (newStage >= 5 && prevStage < 5) s.bloomed.set(word.id, word);
    if (correct) {
      s.xp += XP_PER_CORRECT;
      app.addXp(XP_PER_CORRECT);
    }
  };

  const finish = (ranOutOfHearts: boolean) => {
    if (finished.current) return;
    finished.current = true;
    stopSpeaking();
    const s = stats.current;
    const firstTries = [...s.firstTry.values()];
    if (!ranOutOfHearts) {
      s.xp += XP_LESSON_BONUS;
      app.addXp(XP_LESSON_BONUS);
    }
    app.bumpStreak();
    if (chapterForThrottle !== undefined && newWords.length > 0) {
      app.noteIntroduced(chapterForThrottle, newWords.length);
    }
    onFinish({
      total: firstTries.length,
      correct: firstTries.filter(Boolean).length,
      grew: [...s.grew.values()],
      bloomed: [...s.bloomed.values()],
      xp: s.xp,
      words: [...s.seen.values()],
      ranOutOfHearts,
    });
  };

  const advance = (heartsNow: number) => {
    setFeedback(null);
    if (heartsEnabled && heartsNow <= 0) return finish(true);
    if (idx + 1 >= tasks.length) return finish(false);
    setIdx(idx + 1);
  };

  const handleCardAnswer = (word: Word, outcome: AnswerOutcome) => {
    const elapsed = Date.now() - taskStart.current;
    const grade = outcomeToGrade(outcome.correct, outcome.usedHint, elapsed);
    applyGrade(word, grade, outcome.correct);
    let heartsNow = hearts;
    if (!outcome.correct && heartsEnabled) {
      heartsNow = hearts - 1;
      setHearts(heartsNow);
    }
    if (grade === "again" && (requeues.current.get(word.id) ?? 0) < MAX_REQUEUES_PER_WORD) {
      requeues.current.set(word.id, (requeues.current.get(word.id) ?? 0) + 1);
      // Missed vocab cards come back as recognition; a missed participle must
      // come back as the same production exercise.
      const requeueAs: SessionTask = {
        kind: "card",
        word,
        exercise: mode === "participle" ? "type-participle" : "mc-nl-en",
      };
      setTasks((t) => [...t, requeueAs]);
    }
    setFeedback({
      ok: outcome.correct,
      word,
      participle: mode === "participle" ? participleFor(word) ?? undefined : undefined,
    });
  };

  const handlePairsDone = (results: PairsResult[]) => {
    let heartsNow = hearts;
    for (const r of results) {
      const word = pool.find((w) => w.id === r.wordId);
      if (!word) continue;
      const grade: Grade = r.mistakes === 0 ? "good" : r.mistakes === 1 ? "hard" : "again";
      applyGrade(word, grade, r.mistakes === 0);
    }
    if (heartsEnabled && results.some((r) => r.mistakes >= 2)) {
      heartsNow = hearts - 1;
      setHearts(heartsNow);
    }
    advance(heartsNow);
  };

  if (!task) return null;

  const progress = Math.round((idx / tasks.length) * 100);

  return (
    <section>
      <div className="lesson-top">
        <button className="closebtn" aria-label="Quit lesson" onClick={() => { stopSpeaking(); onQuit(); }}>
          ✕
        </button>
        <div className="progressbar">
          <span style={{ width: `${progress}%` }} />
        </div>
        {heartsEnabled && (
          <div className="hearts" aria-label={`${hearts} hearts left`}>
            {Array.from({ length: HEARTS_START }, (_, i) => (
              <span key={i}>{i < hearts ? "❤️" : "🤍"}</span>
            ))}
          </div>
        )}
      </div>

      {task.kind === "pairs" ? (
        <Pairs key={idx} words={task.words} onDone={handlePairsDone} />
      ) : task.exercise === "type-participle" ? (
        <TypeParticiple key={idx} word={task.word} onAnswer={(o) => handleCardAnswer(task.word, o)} />
      ) : task.exercise === "type-nl" ? (
        <TypeDutch key={idx} word={task.word} onAnswer={(o) => handleCardAnswer(task.word, o)} />
      ) : task.exercise === "listen" ? (
        <Listening key={idx} word={task.word} distractors={distractors} onAnswer={(o) => handleCardAnswer(task.word, o)} />
      ) : (
        <MultipleChoice
          key={idx}
          word={task.word}
          distractors={distractors}
          direction={task.exercise === "mc-nl-en" ? "nl-en" : "en-nl"}
          onAnswer={(o) => handleCardAnswer(task.word, o)}
        />
      )}

      <FeedbackSheet feedback={feedback} onContinue={() => advance(hearts)} />
    </section>
  );
}
