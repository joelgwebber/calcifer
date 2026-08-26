/**
 * Shared fuzzy matcher (calcifer-c170 / A4). One relevance function powers both
 * the command palette's ranked search and the archive browser's name filter, so
 * "type a few letters of the title" behaves identically in both.
 *
 * A contiguous, case-insensitive substring is the strongest signal (and an
 * earlier hit outranks a later one); a scattered subsequence match is a weaker
 * fallback so `wkl` still finds "Weekly planning". `null` means no match.
 */
export function scoreMatch(text: string, query: string): number | null {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const t = text.toLowerCase();

  const idx = t.indexOf(q);
  if (idx >= 0) return 1000 - idx; // contiguous run — best; earlier position wins

  // Subsequence fallback: every query char appears in order.
  let ti = 0;
  for (const ch of q) {
    ti = t.indexOf(ch, ti);
    if (ti < 0) return null;
    ti += 1;
  }
  return 100;
}

/** Boolean convenience over {@link scoreMatch} (used by the archive filter). */
export function matchesQuery(text: string, query: string): boolean {
  return scoreMatch(text, query) !== null;
}
