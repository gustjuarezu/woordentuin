/**
 * Progressive letter-reveal hint for type exercises (brief §4.4): first press
 * shows the first letter + word length, each further press one more letter.
 * A leading article/zich is shown in full — it is not the part being tested.
 */
export function maskAnswer(answer: string, reveal: number): string {
  const m = answer.match(/^(de|het|een|zich)\s+/i);
  const lead = m ? m[0].trim() : "";
  const word = answer.slice(m ? m[0].length : 0);
  let out = "";
  let shown = 0;
  for (const ch of word) {
    if (ch === " ") {
      out += "  ";
      continue;
    }
    out += (shown < reveal ? ch : "_") + " ";
    shown++;
  }
  return (lead ? lead + " " : "") + out.trim();
}

export function maskLength(answer: string): number {
  const m = answer.match(/^(de|het|een|zich)\s+/i);
  return answer.slice(m ? m[0].length : 0).replace(/\s/g, "").length;
}
