import { useEffect } from "react";
import type { Word } from "../data/types";
import type { ParticipleInfo } from "../engine/participle";
import { SpeakerButton } from "./Speaker";

export interface FeedbackData {
  ok: boolean;
  word: Word;
  participle?: ParticipleInfo; // set in participle mode — drives the regelmatig/onregelmatig reveal
}

/**
 * Bottom feedback sheet after each answer. This is where the note and the
 * example sentence are safe to show — the answer is already on the table.
 */
export function FeedbackSheet({
  feedback,
  onContinue,
}: {
  feedback: FeedbackData | null;
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
  const pp = feedback?.participle;
  return (
    <div className={`feedback${feedback ? ` ${feedback.ok ? "good" : "bad"} show` : ""}`} aria-live="polite">
      {word && (
        <div className="feedback-inner">
          <div className="fb-head">
            <div className="fb-title">{feedback!.ok ? "🌿 Goed!" : "Bijna —"}</div>
            <SpeakerButton text={pp ? pp.participle : word.nl} size="sm" />
          </div>
          {pp ? (
            <>
              <div className="fb-answer">
                {!feedback!.ok && "Answer: "}
                <b>
                  {pp.aux === "zijn" ? "is " : pp.aux === "beide" ? "(is) " : ""}
                  {pp.participle}
                </b>{" "}
                — {word.nl} ({word.primaryEn})
              </div>
              <div className="fb-answer" style={{ marginTop: 6 }}>
                {pp.irregular ? (
                  <>
                    <span className="tag tag-irr">onregelmatig</span>{" "}
                    <span style={{ color: "var(--ink-soft)" }}>learn this form by heart</span>
                  </>
                ) : (
                  <>
                    <span className="tag">regelmatig</span>{" "}
                    {pp.parts && <span style={{ color: "var(--ink-soft)" }}>{pp.parts.join(" + ")}</span>}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="fb-answer">
              {!feedback!.ok && "Answer: "}
              <b>{word.nl}</b> — {word.en.join("; ")}
              {word.note ? <span style={{ color: "var(--ink-soft)" }}> · {word.note}</span> : null}
            </div>
          )}
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
