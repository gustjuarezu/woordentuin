import { useMemo, useState } from "react";
import type { Word } from "../../data/types";
import { shuffle } from "../../engine/session";
import { SpeakerButton } from "../Speaker";
import { HintArea } from "./HintArea";
import type { ExerciseProps } from "./types";

/**
 * NL→EN and EN→NL multiple choice. The Dutch side gets a speaker button only
 * when the Dutch is already visible (brief §6). Hint = 50/50.
 * The `hint` surface form is shown only on NL→EN cards (it would help reveal
 * the answer on EN→NL); `note` is never shown before answering.
 */
export function MultipleChoice({
  word,
  distractors,
  direction,
  onAnswer,
}: ExerciseProps & { direction: "nl-en" | "en-nl" }) {
  const [answered, setAnswered] = useState<string | null>(null);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [usedHint, setUsedHint] = useState(false);

  const options = useMemo(() => {
    const label = (w: Word) => (direction === "nl-en" ? w.primaryEn : w.nl);
    return shuffle([word, ...distractors]).map((w) => ({ id: w.id, label: label(w) }));
  }, [word, distractors, direction]);

  const prompt = direction === "nl-en" ? word.nl : word.primaryEn;

  const choose = (id: string) => {
    if (answered) return;
    setAnswered(id);
    onAnswer({ correct: id === word.id, usedHint });
  };

  const fiftyFifty = () => {
    const wrongs = shuffle(options.filter((o) => o.id !== word.id && !eliminated.includes(o.id)));
    setEliminated([...eliminated, ...wrongs.slice(0, 2).map((o) => o.id)]);
    setUsedHint(true);
  };

  return (
    <>
      <p className="prompt-kind">{direction === "nl-en" ? "What does this mean?" : "Say it in Dutch"}</p>
      <div className="q-row">
        <h2 className="q-word">{prompt}</h2>
        {direction === "nl-en" && <SpeakerButton text={word.nl} />}
      </div>
      <p className="q-hint">{direction === "nl-en" && word.hint ? word.hint : " "}</p>
      <HintArea
        label="💡 Hint"
        hintText={usedHint ? "Two options removed" : ""}
        disabled={usedHint || Boolean(answered)}
        onHint={fiftyFifty}
      />
      <div className="options">
        {options.map((o) => {
          let cls = "opt";
          if (eliminated.includes(o.id)) cls += " eliminated";
          if (answered) {
            if (o.id === word.id) cls += " correct";
            else if (o.id === answered) cls += " wrong";
            else cls += " dim";
          }
          return (
            <button key={o.id} className={cls} onClick={() => choose(o.id)} disabled={Boolean(answered)}>
              {o.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
