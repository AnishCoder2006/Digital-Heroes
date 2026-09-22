import { MAX_SCORES, SCORE_MAX, SCORE_MIN } from "./config";

export type ScoreRow = { id: string; score: number; played_on: string };

/** Returns an error message, or null when the entry is valid. */
export function validateScore(score: number, playedOn: string, today = new Date()): string | null {
  if (!Number.isInteger(score) || score < SCORE_MIN || score > SCORE_MAX) {
    return `Scores are whole numbers from ${SCORE_MIN} to ${SCORE_MAX} (Stableford).`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(playedOn) || Number.isNaN(Date.parse(playedOn))) {
    return "Choose the date you played.";
  }
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);
  if (new Date(`${playedOn}T00:00:00`) > endOfToday) return "The date can't be in the future.";
  return null;
}

/** Newest first. */
export const sortScores = <T extends { played_on: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => (a.played_on < b.played_on ? 1 : a.played_on > b.played_on ? -1 : 0));

/**
 * Rolling window rule: only the latest 5 scores (by played date) are kept.
 * A new score pushes the oldest one out. One score per date.
 */
export function planScoreInsert(
  existing: ScoreRow[],
  incoming: { score: number; played_on: string },
): { error?: string; dropIds: string[] } {
  if (existing.some((s) => s.played_on === incoming.played_on)) {
    return { error: "You already have a score for that date. Edit or delete it instead.", dropIds: [] };
  }
  const NEW_ID = "__new__";
  const ranked = sortScores([...existing, { id: NEW_ID, ...incoming }]);
  const dropped = ranked.slice(MAX_SCORES);
  if (dropped.some((s) => s.id === NEW_ID)) {
    return {
      error: `That round is older than your latest ${MAX_SCORES} scores, so it wasn't saved.`,
      dropIds: [],
    };
  }
  return { dropIds: dropped.map((s) => s.id) };
}
