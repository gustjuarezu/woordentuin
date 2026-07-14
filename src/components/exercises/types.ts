import type { Word } from "../../data/types";

export interface AnswerOutcome {
  correct: boolean;
  usedHint: boolean;
}

export interface ExerciseProps {
  word: Word;
  distractors: Word[];
  onAnswer: (outcome: AnswerOutcome) => void;
}
