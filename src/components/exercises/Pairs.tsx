import { useMemo, useRef, useState } from "react";
import type { Word } from "../../data/types";
import { shuffle } from "../../engine/session";

export interface PairsResult {
  wordId: string;
  mistakes: number;
}

/**
 * Tap-the-pairs: match NL ↔ EN in a two-column grid. Each word tracks its
 * mismatch count so the runner can grade it (clean match → good, misses →
 * hard/again).
 */
export function Pairs({ words, onDone }: { words: Word[]; onDone: (results: PairsResult[]) => void }) {
  const left = useMemo(() => shuffle(words), [words]);
  const right = useMemo(() => shuffle(words), [words]);
  const [selLeft, setSelLeft] = useState<string | null>(null);
  const [selRight, setSelRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [missing, setMissing] = useState<Set<string>>(new Set()); // ids flashing red
  const mistakes = useRef(new Map<string, number>());
  const done = useRef(false);

  const attempt = (leftId: string | null, rightId: string | null) => {
    if (leftId === null || rightId === null) return;
    if (leftId === rightId) {
      const next = new Set(matched).add(leftId);
      setMatched(next);
      setSelLeft(null);
      setSelRight(null);
      if (next.size === words.length && !done.current) {
        done.current = true;
        const results = words.map((w) => ({ wordId: w.id, mistakes: mistakes.current.get(w.id) ?? 0 }));
        setTimeout(() => onDone(results), 500);
      }
    } else {
      mistakes.current.set(leftId, (mistakes.current.get(leftId) ?? 0) + 1);
      mistakes.current.set(rightId, (mistakes.current.get(rightId) ?? 0) + 1);
      setMissing(new Set([leftId + ":nl", rightId + ":en"]));
      setTimeout(() => setMissing(new Set()), 400);
      setSelLeft(null);
      setSelRight(null);
    }
  };

  const clsFor = (id: string, side: "nl" | "en", selected: boolean) => {
    let cls = "pair-btn";
    if (matched.has(id)) cls += " matched";
    else if (missing.has(id + ":" + side)) cls += " miss";
    else if (selected) cls += " selected";
    return cls;
  };

  return (
    <>
      <p className="prompt-kind">Match the pairs</p>
      <div className="pairs-grid">
        <div className="pairs-col">
          {left.map((w) => (
            <button
              key={w.id}
              className={clsFor(w.id, "nl", selLeft === w.id)}
              disabled={matched.has(w.id)}
              onClick={() => {
                const v = selLeft === w.id ? null : w.id;
                setSelLeft(v);
                attempt(v, selRight);
              }}
            >
              {w.nl}
            </button>
          ))}
        </div>
        <div className="pairs-col">
          {right.map((w) => (
            <button
              key={w.id}
              className={clsFor(w.id, "en", selRight === w.id)}
              disabled={matched.has(w.id)}
              onClick={() => {
                const v = selRight === w.id ? null : w.id;
                setSelRight(v);
                attempt(selLeft, v);
              }}
            >
              {w.primaryEn}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
