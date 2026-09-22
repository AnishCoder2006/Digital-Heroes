import { DRAW_MAX, DRAW_MIN, DRAW_NUMBER_COUNT } from "../config";

export type Rng = () => number;

const allNumbers = () => Array.from({ length: DRAW_MAX - DRAW_MIN + 1 }, (_, i) => DRAW_MIN + i);

/** Standard lottery style: 5 distinct numbers, equal odds. */
export function randomDraw(rng: Rng = Math.random): number[] {
  const pool = allNumbers();
  const picked: number[] = [];
  while (picked.length < DRAW_NUMBER_COUNT) {
    const i = Math.floor(rng() * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked.sort((a, b) => a - b);
}

/** How often each score value appears across every entered score. */
export function buildFrequencies(allScores: number[]): Record<number, number> {
  const freq: Record<number, number> = {};
  for (const s of allScores) freq[s] = (freq[s] ?? 0) + 1;
  return freq;
}

/**
 * Algorithmic draw: numbers that players score more often are more likely to be drawn.
 * Every number keeps a base weight of 1 so any number can still come up.
 */
export function weightedDraw(freq: Record<number, number>, rng: Rng = Math.random): number[] {
  const pool = allNumbers().map((n) => ({ n, w: (freq[n] ?? 0) + 1 }));
  const picked: number[] = [];
  while (picked.length < DRAW_NUMBER_COUNT) {
    const total = pool.reduce((sum, p) => sum + p.w, 0);
    let target = rng() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      target -= pool[idx].w;
      if (target < 0) break;
    }
    picked.push(pool.splice(idx, 1)[0].n);
  }
  return picked.sort((a, b) => a - b);
}
