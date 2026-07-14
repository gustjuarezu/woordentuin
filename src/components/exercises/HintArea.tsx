export function HintArea({
  label,
  hintText,
  disabled,
  onHint,
}: {
  label: string;
  hintText: string;
  disabled: boolean;
  onHint: () => void;
}) {
  return (
    <div className="hint-area">
      <button className="hintbtn" onClick={onHint} disabled={disabled}>
        {label}
      </button>
      <span className="hint-text" aria-live="polite">{hintText}</span>
    </div>
  );
}
