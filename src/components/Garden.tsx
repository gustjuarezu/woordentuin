import type { Word } from "../data/types";
import { growthStage, type CardState } from "../engine/srs";
import { Sprout } from "./icons";

/** A chapter's garden: one plant per word, growing with SRS mastery. */
export function Garden({ words, states }: { words: Word[]; states: Map<string, CardState> }) {
  return (
    <div className="garden" role="img" aria-label="Word garden">
      {words.map((w) => (
        <div className="sprout" key={w.id} title={w.nl}>
          <Sprout stage={growthStage(states.get(w.id))} />
        </div>
      ))}
    </div>
  );
}
