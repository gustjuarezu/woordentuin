import { useCallback, useRef, useState } from "react";
import { hasDutchVoice, NO_VOICE_HELP, speak, ttsSupported } from "../audio/tts";
import { SpeakerIcon } from "./icons";

let noVoiceWarned = false;

export function useSpeak() {
  return useCallback((text: string, onState?: (playing: boolean) => void) => {
    const ok = speak(text, { onStart: () => onState?.(true), onEnd: () => onState?.(false) });
    if (!ok && !noVoiceWarned && ttsSupported()) {
      noVoiceWarned = true;
      alert(NO_VOICE_HELP);
    }
    return ok;
  }, []);
}

export function SpeakerButton({
  text,
  size,
  autoFocus,
}: {
  text: string;
  size?: "sm" | "lg";
  autoFocus?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const doSpeak = useSpeak();
  const btn = useRef<HTMLButtonElement>(null);
  if (!ttsSupported()) return null;
  return (
    <button
      ref={btn}
      className={`speaker${size ? ` ${size}` : ""}${playing ? " playing" : ""}`}
      aria-label={`Hear “${text}” in Dutch`}
      autoFocus={autoFocus}
      onClick={() => doSpeak(text, setPlaying)}
    >
      <SpeakerIcon />
    </button>
  );
}

export function speakerAvailable(): boolean {
  return ttsSupported() && hasDutchVoice();
}
