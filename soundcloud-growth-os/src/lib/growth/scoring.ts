export type EngagementInput = {
  plays: number;
  likes: number;
  comments: number;
  reposts: number;
  downloads?: number;
};

export type MomentumInput = {
  playsLast24h: number;
  averageDailyPlaysLast14d: number;
};

export type FanScoreInput = {
  comments: number;
  reposts: number;
  likes: number;
  follows?: number;
};

export type ReplyPriorityInput = {
  fanScore: number;
  sentiment: "positive" | "neutral" | "negative" | "unknown";
  isQuestion: boolean;
  commentAgeHours: number;
};

export function engagementRate(input: EngagementInput) {
  const downloads = input.downloads ?? 0;
  return (input.likes + input.comments * 4 + input.reposts * 6 + downloads * 2) / Math.max(input.plays, 1);
}

export function momentumScore(input: MomentumInput) {
  return input.playsLast24h / Math.max(input.averageDailyPlaysLast14d, 1);
}

export function fanScore(input: FanScoreInput) {
  return input.comments * 5 + input.reposts * 8 + input.likes * 2 + (input.follows ?? 0) * 10;
}

export function replyPriority(input: ReplyPriorityInput) {
  const sentimentPositiveBonus = input.sentiment === "positive" ? 10 : 0;
  const questionBonus = input.isQuestion ? 8 : 0;
  const recentCommentBonus = input.commentAgeHours <= 24 ? 6 : input.commentAgeHours <= 72 ? 3 : 0;
  return input.fanScore + sentimentPositiveBonus + questionBonus + recentCommentBonus;
}

export function roundScore(value: number) {
  return Math.round(value * 1000) / 1000;
}
