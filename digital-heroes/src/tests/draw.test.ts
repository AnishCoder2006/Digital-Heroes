import { describe, expect, it } from "vitest";
import { randomDraw, weightedDraw } from "@/lib/draw/generate";
import { findWinners, matchCount } from "@/lib/draw/match";

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

describe("draw generation", () => {
  it("random draw gives 5 distinct numbers in 1-45", () => {
    for (let i = 1; i < 50; i++) {
      const d = randomDraw(seeded(i));
      expect(d).toHaveLength(5);
      expect(new Set(d).size).toBe(5);
      expect(d.every((n) => n >= 1 && n <= 45)).toBe(true);
    }
  });
  it("weighted draw favours frequent scores", () => {
    const freq = { 30: 500, 31: 500, 32: 500, 33: 500, 34: 500 };
    let hits = 0;
    for (let i = 1; i <= 200; i++) hits += weightedDraw(freq, seeded(i)).filter((n) => n >= 30 && n <= 34).length;
    expect(hits / 200).toBeGreaterThan(3.5); // ~5 with heavy weights, ~0.55 if unweighted
  });
});

describe("matching", () => {
  it("counts distinct matches and ignores order", () => {
    expect(matchCount([10, 20, 30, 40, 45], [45, 10, 1, 2, 30]).count).toBe(3);
  });
  it("counts a repeated score once", () => {
    expect(matchCount([30, 30, 30, 30, 30], [30, 1, 2, 3, 4]).count).toBe(1);
  });
  it("returns only 3+ matches as winners", () => {
    const w = findWinners(
      [
        { userId: "a", scores: [1, 2, 3, 4, 5] },
        { userId: "b", scores: [1, 2, 3, 40, 41] },
        { userId: "c", scores: [1, 2, 3, 4, 41] },
      ],
      [1, 2, 3, 4, 5],
    );
    expect(w.map((x) => [x.userId, x.tier])).toEqual([["a", 5], ["b", 3], ["c", 4]]);
  });
});
