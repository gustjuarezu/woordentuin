import { useMemo, useRef, useState } from "react";
import { checkParticiple, participleFor } from "../../engine/participle";
import { maskAnswer, maskLength } from "../../engine/mask";
import { HintArea } from "./HintArea";
import type { ExerciseProps } from "./types";

/**
 * Infinitive shown → type the voltooid deelwoord. Strict on the participle
 * spelling (that's the skill), forgiving on diacritics and a leading
 * auxiliary/"zich". No speaker on the prompt: the infinitive's audio is
 * useless and the participle's would reveal the answer — the feedback sheet
 * speaks the participle afterwards.
 */
export function TypeParticiple({ word, onAnswer }: Omit<ExerciseProps, "distractors">) {
  const [value, setValue] = useState("");
  const [reveal, setReveal] = useState(0);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const info = useMemo(() => participleFor(word), [word]);

  if (!info) return null; // pool is pre-filtered; can't happen in practice

  const submit = () => {
    if (result) return;
    if (!value.trim()) {
      input.current?.focus();
      return;
    }
    const ok = checkParticiple(info, value);
    setResult(ok ? "correct" : "wrong");
    onAnswer({ correct: ok, usedHint: reveal > 0 });
  };

  const hint = () => {
    setReveal((r) => Math.min(r + 1, maskLength(info.participle)));
  };

  return (
    <>
      <p className="prompt-kind">Voltooid deelwoord</p>
      <div className="q-row">
        <h2 className="q-word">{word.nl}</h2>
      </div>
      <p className="q-hint">{word.primaryEn}</p>
      <HintArea
        label="💡 Hint"
        hintText={reveal > 0 ? maskAnswer(info.participle, reveal) : ""}
        disabled={Boolean(result) || reveal >= maskLength(info.participle)}
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
        placeholder="ik heb / ben …"
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
