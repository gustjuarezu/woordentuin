import { useRef, useState } from "react";
import { checkDutch } from "../../engine/checkAnswer";
import { maskAnswer, maskLength } from "../../engine/mask";
import { useApp } from "../../store/useApp";
import { SpeakerButton } from "../Speaker";
import { HintArea } from "./HintArea";
import type { ExerciseProps } from "./types";

/**
 * English shown → type the Dutch. Forgiving check (§3.3). Hint = progressive
 * letter reveal; no surface-form line is ever auto-shown (it revealed the
 * answer in the prototype). The speaker only appears after answering, unless
 * the audioOnProduction setting is on.
 */
export function TypeDutch({ word, onAnswer }: Omit<ExerciseProps, "distractors">) {
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(0);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const audioOnProduction = useApp((s) => s.settings.audioOnProduction);

  const submit = () => {
    if (result) return;
    if (!value.trim()) {
      input.current?.focus();
      return;
    }
    const ok = checkDutch(word, value);
    setResult(ok ? "correct" : "wrong");
    onAnswer({ correct: ok, usedHint: reveal > 0 });
  };

  const hint = () => {
    setReveal((r) => Math.min(r + 1, maskLength(word.nl)));
  };

  return (
    <>
      <p className="prompt-kind">Type it in Dutch</p>
      <div className="q-row">
        <h2 className="q-word">{word.primaryEn}</h2>
        {audioOnProduction && <SpeakerButton text={word.nl} />}
      </div>
      <p className="q-hint"> </p>
      <HintArea
        label="💡 Hint"
        hintText={reveal > 0 ? maskAnswer(word.nl, reveal) : ""}
        disabled={Boolean(result) || reveal >= maskLength(word.nl)}
        onHint={hint}
      />
      <input
        ref={input}
        className={`typebox${result ? ` ${result}` : ""}`}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="Type the Dutch word…"
        value={value}
        autoFocus
        readOnly={Boolean(result)}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
      {!result && (
        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={submit}>
            Check
          </button>
        </div>
      )}
    </>
  );
}
