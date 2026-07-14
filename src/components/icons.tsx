/** Inline SVG sprites ported from the prototype (brand mark, chips, garden sprouts). */

export function BrandMark({ className = "mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 28V14" stroke="#2E7C46" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 16C16 11 12 8 7 8c0 5 4 8 9 8Z" fill="#3E9D5B" />
      <path d="M16 13c0-4 3.5-7 8-7 0 4-3.5 7-8 7Z" fill="#6CC089" />
      <path d="M9 28h14" stroke="#7B5A40" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function FlameIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2c1 3-1 4-1 6 0 1 1 2 2 2 1-1 1-2 1-3 2 2 3 4 3 7a7 7 0 1 1-14 0c0-4 3-6 4-9 1 2 2 3 2 0Z" />
    </svg>
  );
}

export function LeafIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22V11" />
      <path d="M12 13C12 8 8 5 3 5c0 5 4 8 9 8Z" />
      <path d="M12 10c0-4 4-7 9-7 0 4-4 7-9 7Z" />
    </svg>
  );
}

export function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4 9v6h4l5 5V4L8 9H4z" />
      <path d="M16 8a4 4 0 0 1 0 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const SOIL = <rect x="2" y="20" width="20" height="4" rx="2" fill="#C9B79E" />;

/** Growth stages 0 (seed) … 5 (bloom), same drawings as the prototype. */
export function Sprout({ stage }: { stage: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {SOIL}
      {stage <= 0 && <circle cx="12" cy="20" r="1.6" fill="#7B5A40" />}
      {stage === 1 && <path d="M12 21v-5" stroke="#3E9D5B" strokeWidth="2" strokeLinecap="round" />}
      {stage === 2 && (
        <>
          <path d="M12 21v-7" stroke="#2E7C46" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 16c0-2-2-3-4-3 0 2 2 3 4 3Z" fill="#6CC089" />
        </>
      )}
      {stage === 3 && (
        <>
          <path d="M12 21v-9" stroke="#2E7C46" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 15c0-2-2-3-4-3 0 2 2 3 4 3Z" fill="#6CC089" />
          <path d="M12 13c0-2 2-3 4-3 0 2-2 3-4 3Z" fill="#3E9D5B" />
        </>
      )}
      {stage === 4 && (
        <>
          <path d="M12 21v-10" stroke="#2E7C46" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 16c0-2-3-3-5-3 0 2 3 3 5 3Z" fill="#6CC089" />
          <path d="M12 13c0-2 3-3 5-3 0 2-3 3-5 3Z" fill="#3E9D5B" />
          <circle cx="12" cy="9" r="2" fill="#9FD9B3" />
        </>
      )}
      {stage >= 5 && (
        <>
          <path d="M12 21v-9" stroke="#2E7C46" strokeWidth="2" strokeLinecap="round" />
          <path d="M12 16c0-2-3-3-5-3 0 2 3 3 5 3Z" fill="#6CC089" />
          <path d="M12 14c0-2 3-3 5-3 0 2-3 3-5 3Z" fill="#3E9D5B" />
          <circle cx="12" cy="7" r="2.2" fill="#E2A13B" />
          <circle cx="9.5" cy="8.5" r="1.8" fill="#F2C46B" />
          <circle cx="14.5" cy="8.5" r="1.8" fill="#F2C46B" />
          <circle cx="12" cy="10" r="1.8" fill="#F2C46B" />
          <circle cx="12" cy="8.5" r="1.3" fill="#C8603E" />
        </>
      )}
    </svg>
  );
}
