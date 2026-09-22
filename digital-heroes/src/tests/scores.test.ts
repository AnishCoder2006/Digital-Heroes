import { describe, expect, it } from "vitest";
import { planScoreInsert, validateScore } from "@/lib/scores";

const row = (id: string, played_on: string, score = 30) => ({ id, played_on, score });

describe("validateScore", () => {
  it("accepts 1 and 45, rejects 0, 46 and decimals", () => {
    const today = new Date("2026-09-20");
    expect(validateScore(1, "2026-09-01", today)).toBeNull();
    expect(validateScore(45, "2026-09-01", today)).toBeNull();
    expect(validateScore(0, "2026-09-01", today)).not.toBeNull();
    expect(validateScore(46, "2026-09-01", today)).not.toBeNull();
    expect(validateScore(20.5, "2026-09-01", today)).not.toBeNull();
  });
  it("rejects future dates", () => {
    expect(validateScore(30, "2027-01-01", new Date("2026-09-20"))).not.toBeNull();
  });
});

describe("planScoreInsert (rolling 5)", () => {
  const five = [row("a", "2026-09-01"), row("b", "2026-09-02"), row("c", "2026-09-03"), row("d", "2026-09-04"), row("e", "2026-09-05")];

  it("keeps everything while under 5", () => {
    expect(planScoreInsert(five.slice(0, 3), { score: 20, played_on: "2026-09-10" })).toEqual({ dropIds: [] });
  });
  it("drops the oldest when a 6th arrives", () => {
    expect(planScoreInsert(five, { score: 20, played_on: "2026-09-10" })).toEqual({ dropIds: ["a"] });
  });
  it("blocks a second score on the same date", () => {
    expect(planScoreInsert(five, { score: 20, played_on: "2026-09-03" }).error).toBeDefined();
  });
  it("refuses a round older than the latest five", () => {
    expect(planScoreInsert(five, { score: 20, played_on: "2026-08-01" }).error).toBeDefined();
  });
});
