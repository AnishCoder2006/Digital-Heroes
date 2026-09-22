import type { Tier } from "../config";

export type Entry = { userId: string; scores: number[] };
export type Match = { userId: string; tier: Tier; matched: number[]; count: number };

/** Distinct score values that appear in the drawn numbers. */
export function matchCount(scores: number[], drawn: number[]): { count: number; matched: number[] } {
  const drawnSet = new Set(drawn);
  const matched = [...new Set(scores)].filter((s) => drawnSet.has(s)).sort((a, b) => a - b);
  return { count: matched.length, matched };
}

/** Everyone with 3, 4 or 5 matches. Each user appears at most once. */
export function findWinners(entries: Entry[], drawn: number[]): Match[] {
  const winners: Match[] = [];
  for (const e of entries) {
    const { count, matched } = matchCount(e.scores, drawn);
    if (count >= 3) winners.push({ userId: e.userId, tier: count as Tier, matched, count });
  }
  return winners;
}
