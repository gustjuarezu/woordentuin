import { useEffect, useMemo, useState } from "react";
import { shuffle } from "../../engine/session";
import { SpeakerIcon } from "../icons";
import { useSpeak } from "../Speaker";
import { HintArea } from "./HintArea";
import type { ExerciseProps } from "./types";

/**
 * Listening: the Dutch word is spoken (never shown) → choose the matching
 * Dutch text. Only assigned when a real Dutch voice exists (session builder
 * checks). Hint = 50/50.
 */
export function Listening({ word, distractors, onAnswer }: ExerciseProps) {
  const [answered, setAnswered] = useState<string | null>(null);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [usedHint, setUsedHint] = useState(false);
  const [playing, setPlaying] = useState(false);
  const doSpeak = useSpeak();

  const options = useMemo(
    () => shuffle([word, ...distractors]).map((w) => ({ id: w.id, label: w.nl })),
    [word, distractors],
  );

  useEffect(() => {
    // The lesson was started by a tap, so speaking here is user-initiated
    // enough for mobile Safari; a replay button is always present anyway.
    const t = setTimeout(() => doSpeak(word.nl, setPlaying), 350);
    return () => clearTimeout(t);
  }, [word.nl, doSpeak]);

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
      <p className="prompt-kind">What do you hear?</p>
      <div className="listen-stage">
        <button
          className={`speaker lg${playing ? " playing" : ""}`}
          aria-label="Play the Dutch word"
          onClick={() => doSpeak(word.nl, setPlaying)}
        >
          <SpeakerIcon />
        </button>
      </div>
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
