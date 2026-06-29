import { describe, expect, it } from "vitest";
import { engagementRate, fanScore, momentumScore, replyPriority, roundScore } from "../lib/growth/scoring";

describe("growth scoring", () => {
  it("weights engagement by action value and protects against divide-by-zero", () => {
    expect(roundScore(engagementRate({ plays: 100, likes: 5, comments: 2, reposts: 1, downloads: 1 }))).toBe(0.21);
    expect(engagementRate({ plays: 0, likes: 1, comments: 0, reposts: 0 })).toBe(1);
  });

  it("scores momentum against the recent baseline", () => {
    expect(momentumScore({ playsLast24h: 20, averageDailyPlaysLast14d: 10 })).toBe(2);
    expect(momentumScore({ playsLast24h: 4, averageDailyPlaysLast14d: 0 })).toBe(4);
  });

  it("prioritizes real fans and recent actionable comments", () => {
    const score = fanScore({ comments: 2, reposts: 1, likes: 3, follows: 1 });
    expect(score).toBe(34);
    expect(replyPriority({ fanScore: score, sentiment: "positive", isQuestion: true, commentAgeHours: 4 })).toBe(58);
  });
});
