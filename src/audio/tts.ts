/**
 * Dutch text-to-speech via the Web Speech API (brief §6).
 *
 * Hard rule: never read Dutch text with a non-Dutch voice. The voice is
 * resolved at call time because voices load asynchronously on iOS/Safari.
 * The interface is deliberately small so a cloud TTS can be dropped in later.
 */

const speechOK = typeof window !== "undefined" && "speechSynthesis" in window;

if (speechOK) {
  // Warm up the async voice list.
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

/** Preference: nl-NL over nl-BE; enhanced/premium/natural over compact;
 * a female-sounding name; otherwise the first Dutch voice. */
export function pickDutchVoice(): SpeechSynthesisVoice | null {
  if (!speechOK) return null;
  const voices = window.speechSynthesis.getVoices() ?? [];
  const dutch = voices.filter((v) => /^nl(\b|[-_])/i.test(v.lang));
  if (!dutch.length) return null;
  const nlNL = dutch.filter((v) => /nl[-_]?nl/i.test(v.lang));
  const pool = nlNL.length ? nlNL : dutch;
  const female = /(ellen|lotte|colette|femke|saskia|claire|fenna|lisa|google|female|vrouw)/i;
  const enhanced = /(enhanced|premium|neural|natural|siri)/i;
  return (
    pool.find((v) => female.test(v.name) && enhanced.test(v.name)) ??
    pool.find((v) => female.test(v.name)) ??
    pool.find((v) => enhanced.test(v.name)) ??
    pool[0]
  );
}

export function hasDutchVoice(): boolean {
  return pickDutchVoice() !== null;
}

export function ttsSupported(): boolean {
  return speechOK;
}

export interface SpeakHandle {
  onStart?: () => void;
  onEnd?: () => void;
}

/** Speak Dutch text. Returns false when no Dutch voice is available
 * (callers should then show installation help instead of speaking). */
export function speak(text: string, handle: SpeakHandle = {}): boolean {
  if (!speechOK) return false;
  const voice = pickDutchVoice();
  if (!voice) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang || "nl-NL";
    u.rate = 0.9;
    u.pitch = 1.04;
    u.onstart = () => handle.onStart?.();
    u.onend = () => handle.onEnd?.();
    u.onerror = () => handle.onEnd?.();
    window.speechSynthesis.speak(u);
    handle.onStart?.();
    return true;
  } catch {
    handle.onEnd?.();
    return false;
  }
}

export function stopSpeaking(): void {
  if (speechOK) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

export const NO_VOICE_HELP =
  "No Dutch voice is installed on this device, so Woordentuin won't read words with an English voice (that sounds wrong).\n\n" +
  "iPhone/iPad: Settings → Accessibility → Spoken Content → Voices → Add New Voice → Nederlands (Dutch). Pick an “Enhanced” one, then reopen this app.\n\n" +
  "Mac: System Settings → Accessibility → Spoken Content → System Voice → Manage Voices → Dutch.\n\n" +
  "Android/Chrome: install Google Text-to-Speech and add the Dutch language pack.";
