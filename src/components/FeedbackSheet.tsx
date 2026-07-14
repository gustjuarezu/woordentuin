import { useEffect } from "react";
import type { Word } from "../data/types";
import { SpeakerButton } from "./Speaker";

/**
 * Bottom feedback sheet after each answer. This is where the note and the
 * example sentence are safe to show — the answer is already on the table.
 */
export function FeedbackSheet({
  feedback,
  onContinue,
}: {
  feedback: { ok: boolean; word: Word } | null;
  onContinue: () => void;
}) {
  useEffect(() => {
    if (!feedback) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onContinue();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [feedback, onContinue]);

  const word = feedback?.word;
  return (
    <div className={`feedback${feedback ? ` ${feedback.ok ? "good" : "bad"} show` : ""}`} aria-live="polite">
      {word && (
        <div className="feedback-inner">
          <div className="fb-head">
            <div className="fb-title">{feedback!.ok ? "🌿 Goed!" : "Bijna —"}</div>
            <SpeakerButton text={word.nl} size="sm" />
          </div>
          <div className="fb-answer">
            {!feedback!.ok && "Answer: "}
            <b>{word.nl}</b> — {word.en.join("; ")}
            {word.note ? <span style={{ color: "var(--ink-soft)" }}> · {word.note}</span> : null}
          </div>
          {word.examples?.[0] && <div className="fb-example">“{word.examples[0]}”</div>}
          <div className="fb-cta">
            <button className="btn btn-primary" onClick={onContinue} autoFocus>
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
