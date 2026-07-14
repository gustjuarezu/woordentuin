import { Link } from "react-router-dom";
import { hasDutchVoice, pickDutchVoice, speak, ttsSupported } from "../audio/tts";
import { useApp } from "../store/useApp";

export function SettingsPage() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const resetProgress = useApp((s) => s.resetProgress);
  const voice = pickDutchVoice();

  return (
    <section>
      <Link to="/" className="backlink">
        ← Home
      </Link>
      <h1 style={{ fontSize: "1.9rem" }}>Settings</h1>

      <div className="chapcard">
        <div className="setting">
          <label htmlFor="newPerDay">
            New words per day
            <span className="desc">Per chapter. The rest of a session is reviews.</span>
          </label>
          <input
            id="newPerDay"
            type="number"
            min={1}
            max={30}
            value={settings.newPerDay}
            onChange={(e) => update({ newPerDay: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })}
          />
        </div>
        <div className="setting">
          <label htmlFor="lessonSize">
            Words per lesson
            <span className="desc">How chapters are split into lessons.</span>
          </label>
          <input
            id="lessonSize"
            type="number"
            min={5}
            max={10}
            value={settings.lessonSize}
            onChange={(e) => update({ lessonSize: Math.max(5, Math.min(10, Number(e.target.value) || 7)) })}
          />
        </div>
        <div className="setting">
          <label htmlFor="hearts">
            Hearts
            <span className="desc">Three lives per session, Duolingo-style.</span>
          </label>
          <span className="switch">
            <input
              id="hearts"
              type="checkbox"
              checked={settings.hearts}
              onChange={(e) => update({ hearts: e.target.checked })}
            />
            <span className="knob" />
          </span>
        </div>
        <div className="setting">
          <label htmlFor="audioProd">
            Audio on typing cards
            <span className="desc">Hear the Dutch even when you must produce it (pure listening practice).</span>
          </label>
          <span className="switch">
            <input
              id="audioProd"
              type="checkbox"
              checked={settings.audioOnProduction}
              onChange={(e) => update({ audioOnProduction: e.target.checked })}
            />
            <span className="knob" />
          </span>
        </div>
      </div>

      <div className="chapcard">
        <div className="setting">
          <label>
            Dutch voice
            <span className="desc">
              {!ttsSupported()
                ? "Speech is not supported in this browser."
                : hasDutchVoice()
                  ? `Using “${voice?.name}” (${voice?.lang}).`
                  : "No Dutch voice installed — audio stays off rather than sounding English. iPhone: Settings → Accessibility → Spoken Content → Voices → Nederlands (pick “Enhanced”)."}
            </span>
          </label>
          {hasDutchVoice() && (
            <button className="btn btn-ghost" style={{ flex: "0 0 auto" }} onClick={() => speak("Woordentuin. Stap voor stap groeit je Nederlands.")}>
              Test
            </button>
          )}
        </div>
      </div>

      <button
        className="reset"
        onClick={() => {
          if (confirm("Reset all progress? Your whole garden goes back to seeds.")) void resetProgress();
        }}
      >
        Reset all progress
      </button>
    </section>
  );
}
